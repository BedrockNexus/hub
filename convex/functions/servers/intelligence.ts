import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	internalMutation,
	type QueryCtx,
	query,
} from '../../_generated/server'
import { isPublicServer } from '../../lib/contentVisibility'
import { recentDayKeys, utcDayKey } from '../../lib/dayKeys'
import { HEALTH_WINDOW_DAYS, serverHealth } from '../../lib/serverHealth'

/**
 * Server intelligence (roadmap Phase 5): uptime, latency and player history,
 * the incident timeline, and the daily health score. Public for public
 * servers only.
 *
 * Queries read the newest rows in index order instead of the clock, so they
 * stay cacheable: "24 hours" is the newest 24 hourly rows, and so on.
 */

const BATCH_SIZE = 100
const MAX_EVENTS_PAGE = 50

async function publicServer(ctx: QueryCtx, serverId: Id<'servers'>) {
	const server = await ctx.db.get(serverId)
	return server && isPublicServer(server) ? server : null
}

function uptimeOf(rows: { checks: number; checksOnline: number }[]) {
	const checks = rows.reduce((sum, row) => sum + row.checks, 0)
	if (checks === 0) return null
	const online = rows.reduce((sum, row) => sum + row.checksOnline, 0)
	return Math.round((online / checks) * 10_000) / 10_000
}

function latencyOf(rows: { latencySum: number; latencySamples: number }[]) {
	const samples = rows.reduce((sum, row) => sum + row.latencySamples, 0)
	if (samples === 0) return null
	return Math.round(rows.reduce((sum, row) => sum + row.latencySum, 0) / samples)
}

async function newestHours(ctx: QueryCtx, serverId: Id<'servers'>, count: number) {
	return ctx.db
		.query('serverHourlyStats')
		.withIndex('by_serverId_and_hourStart', (q) => q.eq('serverId', serverId))
		.order('desc')
		.take(count)
}

async function newestDays(ctx: QueryCtx, serverId: Id<'servers'>, count: number) {
	return ctx.db
		.query('serverDailyStats')
		.withIndex('by_serverId_and_dayKey', (q) => q.eq('serverId', serverId))
		.order('desc')
		.take(count)
}

/** Headline numbers for a server page. */
export const getOverview = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const server = await publicServer(ctx, args.serverId)
		if (!server) return null
		const [hours, days, stats, status, latestSnapshot, network] =
			await Promise.all([
				newestHours(ctx, server._id, 24),
				newestDays(ctx, server._id, HEALTH_WINDOW_DAYS),
				ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first(),
				ctx.db
					.query('serverStatus')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.unique(),
				ctx.db
					.query('serverHealthSnapshots')
					.withIndex('by_serverId_and_dayKey', (q) =>
						q.eq('serverId', server._id),
					)
					.order('desc')
					.first(),
				server.networkId ? ctx.db.get(server.networkId) : null,
			])
		return {
			uptime24h: uptimeOf(hours),
			uptime7d: uptimeOf(days.slice(0, 7)),
			uptime30d: uptimeOf(days),
			latency24h: latencyOf(hours),
			healthScore: stats?.healthScore ?? null,
			incidents30d: latestSnapshot?.incidents30d ?? null,
			peakPlayersEver: status?.peakPlayersEver ?? null,
			incidentOpenSince: status?.incidentOpenSince ?? null,
			network: network
				? { publicId: network.publicId, name: network.name }
				: null,
		}
	},
})

/** Hourly points, oldest first, for the 24-hour and 7-day charts. */
export const listHourly = query({
	args: {
		serverId: v.id('servers'),
		hours: v.union(v.literal(24), v.literal(168)),
	},
	handler: async (ctx, args) => {
		if (!(await publicServer(ctx, args.serverId))) return []
		const rows = await newestHours(ctx, args.serverId, args.hours)
		return rows.reverse().map(toPoint)
	},
})

/** Daily points, oldest first, for the 30-day chart. */
export const listDaily = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		if (!(await publicServer(ctx, args.serverId))) return []
		const rows = await newestDays(ctx, args.serverId, HEALTH_WINDOW_DAYS)
		return rows
			.filter((row) => row.checks > 0)
			.reverse()
			.map((row) => ({
				...toPoint(row),
				at: Date.parse(`${row.dayKey}T00:00:00Z`),
			}))
	},
})

function toPoint(
	row: Pick<
		Doc<'serverHourlyStats'>,
		'checks' | 'checksOnline' | 'playerSum' | 'peakPlayers' | 'latencySum' | 'latencySamples'
	> & { hourStart?: number },
) {
	return {
		at: row.hourStart ?? 0,
		uptime: row.checks > 0 ? row.checksOnline / row.checks : 0,
		avgPlayers:
			row.checks > 0 ? Math.round((row.playerSum / row.checks) * 10) / 10 : 0,
		peakPlayers: row.peakPlayers,
		latency:
			row.latencySamples > 0
				? Math.round(row.latencySum / row.latencySamples)
				: null,
	}
}

/** The incident and event timeline, newest first. */
export const listEvents = query({
	args: {
		serverId: v.id('servers'),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		if (!(await publicServer(ctx, args.serverId))) {
			return { page: [], isDone: true, continueCursor: '' }
		}
		const result = await ctx.db
			.query('serverEvents')
			.withIndex('by_serverId_and_at', (q) => q.eq('serverId', args.serverId))
			.order('desc')
			.paginate({
				...args.paginationOpts,
				numItems: Math.min(args.paginationOpts.numItems, MAX_EVENTS_PAGE),
			})
		return {
			...result,
			page: result.page.map((event) => ({
				_id: event._id,
				kind: event.kind,
				at: event.at,
				durationMs: event.durationMs,
				players: event.players,
				fromVersion: event.fromVersion,
				toVersion: event.toVersion,
			})),
		}
	},
})

/**
 * Daily: the health score of every public server from its last 30 days
 * (crons.ts `recompute-server-health`). Pages through all public servers.
 */
export const recomputeHealth = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	handler: async (ctx, args) => {
		const now = Date.now()
		const dayKey = utcDayKey(now)
		const dayKeys = recentDayKeys(now, HEALTH_WINDOW_DAYS)
		const oldest = dayKeys[dayKeys.length - 1]
		const since = now - HEALTH_WINDOW_DAYS * 24 * 60 * 60 * 1000

		const page = await ctx.db
			.query('serverStats')
			.withIndex('by_isPublic_and_publishedAt', (q) => q.eq('isPublic', true))
			.paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

		for (const stats of page.page) {
			const [days, outages] = await Promise.all([
				ctx.db
					.query('serverDailyStats')
					.withIndex('by_serverId_and_dayKey', (q) =>
						q.eq('serverId', stats.serverId).gte('dayKey', oldest),
					)
					.take(HEALTH_WINDOW_DAYS + 1),
				ctx.db
					.query('serverEvents')
					.withIndex('by_serverId_and_at', (q) =>
						q.eq('serverId', stats.serverId).gte('at', since),
					)
					.take(500),
			])
			const incidents = outages.filter((event) => event.kind === 'offline').length
			const health = serverHealth(days, incidents)
			if (stats.healthScore !== health?.score) {
				await ctx.db.patch(stats._id, { healthScore: health?.score })
			}
			if (!health) continue
			const existing = await ctx.db
				.query('serverHealthSnapshots')
				.withIndex('by_serverId_and_dayKey', (q) =>
					q.eq('serverId', stats.serverId).eq('dayKey', dayKey),
				)
				.unique()
			if (existing) {
				await ctx.db.patch(existing._id, health)
			} else {
				await ctx.db.insert('serverHealthSnapshots', {
					serverId: stats.serverId,
					dayKey,
					...health,
				})
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.intelligence.recomputeHealth,
				{ cursor: page.continueCursor },
			)
		}
	},
})
