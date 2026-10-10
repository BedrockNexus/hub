import { v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	action,
	type ActionCtx,
	internalAction,
	internalMutation,
	internalQuery,
	query,
} from '../../_generated/server'
import { authComponent } from '../../auth'

import { isPublicServer } from '../../lib/contentVisibility'
import { recordServerCheck } from '../../lib/discovery'
import { enforceRateLimit } from '../../lib/rateLimits'

// Spacing between scheduled status checks (5-minute cron window).
const PING_STAGGER_MS = 150
// Raw checks are kept this long; longer trends come from rollups.
const STATUS_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const STATUS_HISTORY_DELETE_BATCH = 500

const softwareClassificationValidator = v.union(
	v.literal('native_bedrock'),
	v.literal('geyser_likely'),
	v.literal('ambiguous'),
)
const DEFAULT_STATUS_API_URL = 'https://api.bedrocknexus.com'
const TRAILING_SLASH_PATTERN = /\/$/
const LOCAL_API_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

function getStatusApiBaseUrl() {
	const configuredUrl =
		process.env.BEDROCKNEXUS_API_URL || DEFAULT_STATUS_API_URL
	let url: URL

	try {
		url = new URL(configuredUrl)
	} catch {
		throw new Error('BEDROCKNEXUS_API_URL must be a valid public HTTPS URL')
	}

	if (
		url.protocol !== 'https:' ||
		LOCAL_API_HOSTNAMES.has(url.hostname.toLowerCase())
	) {
		throw new Error(
			'BEDROCKNEXUS_API_URL must be a publicly reachable HTTPS URL because Convex actions cannot access localhost',
		)
	}

	return url.toString().replace(TRAILING_SLASH_PATTERN, '')
}

interface BedrockStatusApiResponse {
	error?: string
	gamemode?: string
	latencyMs?: number
	motd?: string
	online?: boolean
	players?: {
		max?: number
		online?: number
	}
	software?: {
		classification?:
			| 'native_bedrock'
			| 'geyser_likely'
			| 'ambiguous'
		reasons?: string[]
	}
	version?: string
}

type StatusRefreshServer = Pick<
	Doc<'servers'>,
	'_id' | 'ipAddress' | 'name' | 'ownerId' | 'ownerType' | 'port' | 'registeredBy' | 'status'
>

interface StatusRefreshResult {
	serverId: Id<'servers'>
	status: 'online' | 'offline'
	online: boolean
	playerCount?: number
	maxPlayers?: number
	motd?: string
	version?: string
	gameMode?: string
	softwareClassification?: 'native_bedrock' | 'geyser_likely' | 'ambiguous'
	softwareReasons?: string[]
	latency?: number
	lastChecked: number
}

/**
 * Asks the status API about one server. Returns only a definite answer; throws
 * when the API could not give one (unreachable, overloaded, or failing), which
 * says nothing about the server and must never be recorded as downtime.
 */
async function fetchServerStatus(
	server: StatusRefreshServer,
): Promise<BedrockStatusApiResponse> {
	const apiUrl = getStatusApiBaseUrl()
	const apiKey = process.env.BEDROCKNEXUS_API_KEY
	const response = await fetch(
		`${apiUrl}/minecraft/status?ip=${encodeURIComponent(server.ipAddress)}&port=${server.port}&timeout=8000`,
		apiKey ? { headers: { 'X-API-Key': apiKey } } : undefined,
	)

	// The API refused the address (it no longer resolves, or is not public),
	// so players cannot reach it either.
	if (response.status === 400) {
		return { online: false }
	}

	const data = response.ok
		? ((await response.json().catch(() => null)) as BedrockStatusApiResponse | null)
		: null
	if (typeof data?.online !== 'boolean') {
		throw new Error(`Status API returned ${response.status}`)
	}
	return data
}

async function pingAndPersistServerStatus(
	ctx: ActionCtx,
	server: StatusRefreshServer,
): Promise<StatusRefreshResult> {
	const data = await fetchServerStatus(server)
	const online = data.online ?? false
	// Measured by the API around the Bedrock ping itself.
	const latency = online ? data.latencyMs : undefined
	await ctx.runMutation(
		internal.functions.servers.status.internalUpdateStatus,
		{
			serverId: server._id,
			online,
			playerCount: data.players?.online,
			maxPlayers: data.players?.max,
			motd: data.motd,
			version: data.version,
			gameMode: data.gamemode,
			softwareClassification: data.software?.classification,
			softwareReasons: data.software?.reasons,
			latency,
		},
	)

	return {
		serverId: server._id,
		status: online ? 'online' : 'offline',
		online,
		playerCount: online ? data.players?.online : undefined,
		maxPlayers: online ? data.players?.max : undefined,
		motd: online ? data.motd : undefined,
		version: online ? data.version : undefined,
		gameMode: online ? data.gamemode : undefined,
		softwareClassification: online ? data.software?.classification : undefined,
		softwareReasons: online ? data.software?.reasons : undefined,
		latency,
		lastChecked: Date.now(),
	}
}

// =============================================================================
// SERVER STATUS QUERIES
// =============================================================================

/**
 * Get status for a single server
 */
export const getStatus = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
			.unique()
	},
})

/**
 * Get status for multiple servers
 */
export const getStatusBatch = query({
	args: { serverIds: v.array(v.id('servers')) },
	handler: async (ctx, args) => {
		const statuses: Record<
			string,
			{
				_id: Id<'serverStatus'>
				_creationTime: number
				serverId: Id<'servers'>
				online: boolean
				playerCount: number
				maxPlayers: number
				motd?: string
				version?: string
				gameMode?: string
				softwareClassification?:
					| 'native_bedrock'
					| 'geyser_likely'
					| 'ambiguous'
				softwareReasons?: string[]
				latency?: number
				lastChecked: number
				lastOnline?: number
				checksTotal: number
				checksOnline: number
				uptimePercent: number
			}
		> = {}

		for (const serverId of args.serverIds) {
			const status = await ctx.db
				.query('serverStatus')
				.withIndex('by_server', (q) => q.eq('serverId', serverId))
				.unique()

			if (status) {
				statuses[serverId] = status
			}
		}

		return statuses
	},
})

// =============================================================================
// INTERNAL MUTATIONS (for scheduled jobs)
// =============================================================================

/**
 * Records the result of one definite status check: the current status, the
 * lifetime uptime counters, and a history row. This is the only writer of
 * server status.
 */
export const internalUpdateStatus = internalMutation({
	args: {
		serverId: v.id('servers'),
		online: v.boolean(),
		playerCount: v.optional(v.number()),
		maxPlayers: v.optional(v.number()),
		motd: v.optional(v.string()),
		version: v.optional(v.string()),
		gameMode: v.optional(v.string()),
		softwareClassification: v.optional(softwareClassificationValidator),
		softwareReasons: v.optional(v.array(v.string())),
		latency: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// A check can finish after its server was deleted.
		const server = await ctx.db.get(args.serverId)
		if (!server) {
			return
		}

		const now = Date.now()

		await ctx.db.insert('serverStatusHistory', {
			serverId: args.serverId,
			online: args.online,
			playerCount: args.online ? (args.playerCount ?? 0) : 0,
			maxPlayers: args.online ? args.maxPlayers : undefined,
			latency: args.online ? args.latency : undefined,
			checkedAt: now,
		})
		await recordServerCheck(ctx, args.serverId, {
			checkedAt: now,
			online: args.online,
			playerCount: args.playerCount ?? 0,
			latency: args.latency,
		})
		const isPublic = isPublicServer(server)

		const existing = await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
			.unique()

		if (existing) {
			const checksTotal = existing.checksTotal + 1
			const checksOnline = existing.checksOnline + (args.online ? 1 : 0)
			const uptimePercent = Math.round((checksOnline / checksTotal) * 100)

			await ctx.db.patch(existing._id, {
				online: args.online,
				playerCount: args.online ? (args.playerCount ?? 0) : 0,
				maxPlayers: args.online
					? (args.maxPlayers ?? 0)
					: existing.maxPlayers,
				motd: args.online ? args.motd : existing.motd,
				version: args.online ? args.version : existing.version,
				gameMode: args.online ? args.gameMode : existing.gameMode,
				softwareClassification: args.online
					? args.softwareClassification
					: existing.softwareClassification,
				softwareReasons: args.online
					? args.softwareReasons
					: existing.softwareReasons,
				latency: args.online ? args.latency : undefined,
				lastChecked: now,
				lastOnline: args.online ? now : existing.lastOnline,
				checksTotal,
				checksOnline,
				uptimePercent,
				isPublic,
			})
		} else {
			await ctx.db.insert('serverStatus', {
				serverId: args.serverId,
				online: args.online,
				playerCount: args.online ? (args.playerCount ?? 0) : 0,
				maxPlayers: args.online ? (args.maxPlayers ?? 0) : 0,
				motd: args.motd,
				version: args.version,
				gameMode: args.gameMode,
				softwareClassification: args.softwareClassification,
				softwareReasons: args.softwareReasons,
				latency: args.latency,
				lastChecked: now,
				lastOnline: args.online ? now : undefined,
				checksTotal: 1,
				checksOnline: args.online ? 1 : 0,
				uptimePercent: args.online ? 100 : 0,
				isPublic,
			})
		}
	},
})

export const getRefreshableServerForCurrentUser = internalQuery({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args): Promise<StatusRefreshServer | null> => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			return null
		}

		const server = await ctx.db.get(args.serverId)
		if (!server) {
			return null
		}

		if (
			user.role === 'admin' ||
			server.registeredBy === user._id ||
			(server.ownerType === 'user' && server.ownerId === user._id)
		) {
			return server
		}

		if (server.ownerType === 'organization') {
			const member = (await ctx.runQuery(
				components.betterAuth.adapter.findOne,
				{
					model: 'member',
					where: [
						{ field: 'organizationId', value: server.ownerId },
						{ field: 'userId', value: user._id },
					],
				},
			)) as { id?: string } | null

			if (member) {
				return server
			}
		}

		return null
	},
})

export const getPublishedServerForStatusRefresh = internalQuery({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args): Promise<StatusRefreshServer | null> => {
		const server = await ctx.db.get(args.serverId)
		if (!server || server.status !== 'published') {
			return null
		}

		return server
	},
})

export const refreshStatus = action({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args): Promise<StatusRefreshResult> => {
		const server = await ctx.runQuery(
			internal.functions.servers.status.getRefreshableServerForCurrentUser,
			{ serverId: args.serverId },
		)

		if (!server) {
			throw new Error('You do not have permission to refresh this server')
		}
		const user = await authComponent.getAuthUser(ctx)
		await enforceRateLimit(
			ctx,
			'serverStatusRefresh',
			user._id,
			'Too many status refreshes. Please wait before checking again.',
		)

		try {
			return await pingAndPersistServerStatus(ctx, server)
		} catch (error) {
			console.error(`[Status] Could not check ${server.name}:`, error)
			throw new Error(
				'The status service could not check this server right now. Please try again shortly.',
			)
		}
	},
})

export const pingServer = internalAction({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args): Promise<StatusRefreshResult | null> => {
		const server = await ctx.runQuery(
			internal.functions.servers.status.getPublishedServerForStatusRefresh,
			{ serverId: args.serverId },
		)

		if (!server) {
			return null
		}

		try {
			return await pingAndPersistServerStatus(ctx, server)
		} catch (error) {
			// No answer from the status API: skip this cycle rather than
			// counting it against the server's uptime.
			console.error(`[Status] Could not check ${server.name}:`, error)
			return null
		}
	},
})

/**
 * Internal action to ping all servers and update their status
 * This is called by the cron job every 5 minutes
 */
export const pingAllServers = internalAction({
	args: {},
	handler: async (ctx) => {
		const servers = await ctx.runQuery(
			internal.functions.servers.status.getAllActiveServers,
		)

		// Fan out one short action per server, staggered, so a large directory
		// never exceeds a single action's time limit and one slow server cannot
		// delay the others.
		for (const [index, server] of servers.entries()) {
			await ctx.scheduler.runAfter(
				index * PING_STAGGER_MS,
				internal.functions.servers.status.pingServer,
				{ serverId: server._id },
			)
		}

		console.log(`[Cron] Scheduled status checks for ${servers.length} servers`)
	},
})

/**
 * Internal query to get all active servers for the cron job
 */
export const getAllActiveServers = internalQuery({
	args: {},
	returns: v.array(v.object({ _id: v.id('servers') })),
	handler: async (ctx) => {
		const servers = await ctx.db
			.query('servers')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()
		return servers.map((server) => ({ _id: server._id }))
	},
})

/**
 * Deletes raw status checks older than the retention window, one batch per
 * transaction. Called daily by the `purge-server-status-history` cron.
 */
export const purgeStatusHistory = internalMutation({
	args: {},
	handler: async (ctx) => {
		const cutoff = Date.now() - STATUS_HISTORY_RETENTION_MS
		const expired = await ctx.db
			.query('serverStatusHistory')
			.withIndex('by_time', (q) => q.lt('checkedAt', cutoff))
			.take(STATUS_HISTORY_DELETE_BATCH)

		for (const row of expired) {
			await ctx.db.delete(row._id)
		}
		if (expired.length === STATUS_HISTORY_DELETE_BATCH) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.status.purgeStatusHistory,
				{},
			)
		}
	},
})

/**
 * Deletes a removed server's status history and daily totals, one batch per
 * transaction.
 */
export const deleteServerHistory = internalMutation({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query('serverStatusHistory')
			.withIndex('by_server_time', (q) => q.eq('serverId', args.serverId))
			.take(STATUS_HISTORY_DELETE_BATCH)

		for (const row of rows) {
			await ctx.db.delete(row._id)
		}
		if (rows.length === STATUS_HISTORY_DELETE_BATCH) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.status.deleteServerHistory,
				{ serverId: args.serverId },
			)
			return
		}

		const days = await ctx.db
			.query('serverDailyStats')
			.withIndex('by_serverId_and_dayKey', (q) =>
				q.eq('serverId', args.serverId),
			)
			.take(STATUS_HISTORY_DELETE_BATCH)
		for (const day of days) {
			await ctx.db.delete(day._id)
		}
		if (days.length === STATUS_HISTORY_DELETE_BATCH) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.status.deleteServerHistory,
				{ serverId: args.serverId },
			)
		}
	},
})
