import { v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	action,
	type ActionCtx,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from '../../_generated/server'
import { authComponent } from '../../auth'
import { enforceRateLimit } from '../../lib/rateLimits'

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

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Failed to refresh server status'
}

async function persistOfflineStatus(
	ctx: ActionCtx,
	serverId: Id<'servers'>,
): Promise<StatusRefreshResult> {
	await ctx.runMutation(
		internal.functions.servers.status.internalUpdateStatus,
		{
			serverId,
			online: false,
		},
	)

	return {
		serverId,
		status: 'offline',
		online: false,
		lastChecked: Date.now(),
	}
}

async function pingAndPersistServerStatus(
	ctx: ActionCtx,
	server: StatusRefreshServer,
): Promise<StatusRefreshResult> {
	const apiUrl = getStatusApiBaseUrl()
	const apiKey = process.env.BEDROCKNEXUS_API_KEY
	const startedAt = Date.now()
	const response = await fetch(
		`${apiUrl}/minecraft/status?ip=${encodeURIComponent(server.ipAddress)}&port=${server.port}&timeout=8000`,
		apiKey ? { headers: { 'X-API-Key': apiKey } } : undefined,
	)
	const data = (await response.json()) as BedrockStatusApiResponse
	const latency = Date.now() - startedAt

	if (!response.ok) {
		throw new Error(data.error || `Status API returned ${response.status}`)
	}

	const online = data.online ?? false
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
		latency: online ? latency : undefined,
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

/**
 * Get all online servers
 */
export const getOnlineServers = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query('serverStatus')
			.withIndex('by_online', (q) => q.eq('online', true))
			.collect()
	},
})

/**
 * Get servers that need status check (stale data)
 */
export const getStaleServers = query({
	args: {
		maxAgeMinutes: v.optional(v.number()), // Default 5 minutes
	},
	handler: async (ctx, args) => {
		const maxAge = args.maxAgeMinutes ?? 5
		const cutoff = Date.now() - maxAge * 60_000

		const allStatuses = await ctx.db.query('serverStatus').collect()

		return allStatuses.filter((s) => s.lastChecked < cutoff)
	},
})

// =============================================================================
// SERVER STATUS MUTATIONS
// =============================================================================

/**
 * Update server status (called after pinging)
 */
export const updateStatus = mutation({
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
		const now = Date.now()

		const existing = await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
			.unique()

		if (existing) {
			// Update existing record
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
			})

			return existing._id
		}
		// Create new record
		return await ctx.db.insert('serverStatus', {
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
		})
	},
})

/**
 * Mark server as offline (quick update)
 */
export const markOffline = mutation({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const now = Date.now()

		const existing = await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
			.unique()

		if (existing) {
			const checksTotal = existing.checksTotal + 1
			const uptimePercent = Math.round(
				(existing.checksOnline / checksTotal) * 100,
			)

			await ctx.db.patch(existing._id, {
				online: false,
				playerCount: 0,
				latency: undefined,
				lastChecked: now,
				checksTotal,
				uptimePercent,
			})
		} else {
			await ctx.db.insert('serverStatus', {
				serverId: args.serverId,
				online: false,
				playerCount: 0,
				maxPlayers: 0,
				lastChecked: now,
				checksTotal: 1,
				checksOnline: 0,
				uptimePercent: 0,
			})
		}
	},
})

/**
 * Delete status record (when server is deleted)
 */
export const deleteStatus = mutation({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
			.unique()

		if (existing) {
			await ctx.db.delete(existing._id)
			return true
		}
		return false
	},
})

// =============================================================================
// AGGREGATE QUERIES
// =============================================================================

/**
 * Get status summary (for homepage/stats)
 */
export const getSummary = query({
	args: {},
	handler: async (ctx) => {
		const allStatuses = await ctx.db.query('serverStatus').collect()

		const online = allStatuses.filter((s) => s.online)
		const totalPlayers = online.reduce((sum, s) => sum + s.playerCount, 0)
		const avgUptime =
			allStatuses.length > 0
				? Math.round(
						allStatuses.reduce(
							(sum, s) => sum + s.uptimePercent,
							0,
						) / allStatuses.length,
					)
				: 0

		return {
			totalServers: allStatuses.length,
			onlineServers: online.length,
			offlineServers: allStatuses.length - online.length,
			totalPlayers,
			avgUptime,
		}
	},
})

// =============================================================================
// INTERNAL MUTATIONS (for scheduled jobs)
// =============================================================================

/**
 * Internal mutation to update server status (called by the cron action)
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
		const now = Date.now()

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
			await persistOfflineStatus(ctx, args.serverId)
			throw new Error(getErrorMessage(error))
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
			console.error(`[Status] Failed to ping ${server.name}:`, error)
			return await persistOfflineStatus(ctx, args.serverId)
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
		// Get all active servers
		const servers = await ctx.runQuery(
			internal.functions.servers.status.getAllActiveServers,
		)

		console.log(`[Cron] Pinging ${servers.length} servers...`)

		// Ping each server (with some delay to avoid overwhelming the API)
		for (const server of servers) {
			try {
				await pingAndPersistServerStatus(ctx, server)
			} catch (error) {
				console.error(`[Cron] Failed to ping ${server.name}:`, error)
				// Mark as offline on error
				await persistOfflineStatus(ctx, server._id)
			}
		}

		console.log(`[Cron] Finished pinging ${servers.length} servers`)
	},
})

/**
 * Internal query to get all active servers for the cron job
 */
export const getAllActiveServers = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query('servers')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()
	},
})
