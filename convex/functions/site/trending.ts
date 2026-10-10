import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'
import { recentDayKeys, utcDaysBetween } from '../../lib/dayKeys'
import {
	projectTrendingScore,
	serverTrendingStats,
	sumDownloads,
	TRENDING_WINDOW_DAYS,
} from '../../lib/trending'

/**
 * Hourly jobs that turn daily activity into the trending scores listings sort
 * by (crons.ts: `recompute-project-trending`, `recompute-server-trending`).
 * The formulas live in lib/trending.ts. Each run pages through every public
 * item so scores also fade when activity stops, and only writes the ones
 * that changed.
 */

const BATCH_SIZE = 100

const cursorArg = { cursor: v.optional(v.union(v.string(), v.null())) }

export const recomputeProjects = internalMutation({
	args: cursorArg,
	handler: async (ctx, args) => {
		const now = Date.now()
		const dayKeys = recentDayKeys(now, TRENDING_WINDOW_DAYS)
		const oldestKey = dayKeys[dayKeys.length - 1]

		const page = await ctx.db
			.query('projectStats')
			.withIndex('by_isPublic_and_publishedAt', (q) => q.eq('isPublic', true))
			.paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

		for (const stats of page.page) {
			const rows = await ctx.db
				.query('projectDailyStats')
				.withIndex('by_projectId_and_dayKey', (q) =>
					q.eq('projectId', stats.projectId).gte('dayKey', oldestKey),
				)
				.collect()
			const byDay = new Map(rows.map((row) => [row.dayKey, row]))
			const days = dayKeys.map(
				(dayKey) => byDay.get(dayKey) ?? { downloads: 0, favourites: 0 },
			)

			const trendingScore = projectTrendingScore(
				days,
				stats.lastReleaseAt === undefined
					? null
					: utcDaysBetween(stats.lastReleaseAt, now),
			)
			const downloads7d = sumDownloads(days)
			if (
				stats.trendingScore !== trendingScore ||
				stats.downloads7d !== downloads7d
			) {
				await ctx.db.patch(stats._id, { trendingScore, downloads7d })
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.trending.recomputeProjects,
				{ cursor: page.continueCursor },
			)
		}
	},
})

export const recomputeServers = internalMutation({
	args: cursorArg,
	handler: async (ctx, args) => {
		const now = Date.now()
		const dayKeys = recentDayKeys(now, TRENDING_WINDOW_DAYS * 2)
		const recentKeys = new Set(dayKeys.slice(0, TRENDING_WINDOW_DAYS))
		const oldestKey = dayKeys[dayKeys.length - 1]

		const page = await ctx.db
			.query('serverStats')
			.withIndex('by_isPublic_and_publishedAt', (q) => q.eq('isPublic', true))
			.paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

		for (const stats of page.page) {
			const rows = await ctx.db
				.query('serverDailyStats')
				.withIndex('by_serverId_and_dayKey', (q) =>
					q.eq('serverId', stats.serverId).gte('dayKey', oldestKey),
				)
				.collect()
			const next = serverTrendingStats(
				rows.filter((row) => recentKeys.has(row.dayKey)),
				rows.filter((row) => !recentKeys.has(row.dayKey)),
			)

			if (
				stats.trendingScore !== next.trendingScore ||
				stats.avgPlayers7d !== next.avgPlayers7d ||
				stats.peakPlayers7d !== next.peakPlayers7d ||
				stats.uptime7d !== next.uptime7d
			) {
				await ctx.db.patch(stats._id, next)
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.trending.recomputeServers,
				{ cursor: page.continueCursor },
			)
		}
	},
})
