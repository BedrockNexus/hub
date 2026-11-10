import { ConvexError, v } from 'convex/values'
import type { QueryCtx } from '../../_generated/server'
import { query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { dayKeysEndingAt, isDayKey } from '../../lib/dayKeys'
import { canEditContent, type ContentRef } from '../../lib/permissions'

/**
 * Daily analytics for the people who can edit an item, read from the
 * first-party counters (projectDailyStats, pluginDailyStats,
 * serverDailyStats). Never reads OpenPanel.
 *
 * Queries cannot read the clock, so callers pass the last UTC day to show
 * (`endDay`, YYYY-MM-DD) and how many days back to go. Days without a row are
 * returned as zeros, oldest first, ready for a chart.
 */

const MIN_DAYS = 7
const MAX_DAYS = 90
const MAX_VERSIONS = 200

const rangeArgs = {
	endDay: v.string(),
	days: v.number(),
}

function resolveRange(endDay: string, days: number) {
	if (!isDayKey(endDay)) {
		throw new ConvexError('endDay must be a UTC date like 2026-11-09')
	}
	const count = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.floor(days)))
	const keys = dayKeysEndingAt(endDay, count)
	return { keys, startDay: keys[0], endDay }
}

async function requireEditor(ctx: QueryCtx, content: ContentRef) {
	const user = await authComponent.safeGetAuthUser(ctx)
	if (
		!user ||
		!(await canEditContent(ctx, content, user, { allowSiteAdmin: true }))
	) {
		throw new ConvexError({
			code: 'FORBIDDEN',
			message: 'Only people who manage this listing can see its analytics.',
		})
	}
}

function sum<T>(rows: readonly T[], pick: (row: T) => number) {
	return rows.reduce((total, row) => total + pick(row), 0)
}

const downloadDay = v.object({
	day: v.string(),
	views: v.number(),
	downloads: v.number(),
	websiteDownloads: v.number(),
	apiDownloads: v.number(),
})

export const forProject = query({
	args: { projectId: v.id('projects'), ...rangeArgs },
	returns: v.object({
		days: v.array(v.object({ ...downloadDay.fields, saves: v.number() })),
		totals: v.object({
			views: v.number(),
			downloads: v.number(),
			apiDownloads: v.number(),
			saves: v.number(),
			allTimeDownloads: v.number(),
		}),
		versions: v.array(v.object({ version: v.string(), downloads: v.number() })),
	}),
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (!project) throw new ConvexError('Project not found')
		await requireEditor(ctx, project)
		const range = resolveRange(args.endDay, args.days)

		const rows = await ctx.db
			.query('projectDailyStats')
			.withIndex('by_projectId_and_dayKey', (q) =>
				q
					.eq('projectId', project._id)
					.gte('dayKey', range.startDay)
					.lte('dayKey', range.endDay),
			)
			.take(range.keys.length)
		const byDay = new Map(rows.map((row) => [row.dayKey, row]))
		const days = range.keys.map((day) => {
			const row = byDay.get(day)
			const downloads = row?.downloads ?? 0
			const apiDownloads = row?.apiDownloads ?? 0
			return {
				day,
				views: row?.views ?? 0,
				downloads,
				websiteDownloads: downloads - apiDownloads,
				apiDownloads,
				saves: row?.favourites ?? 0,
			}
		})

		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', project._id))
			.take(MAX_VERSIONS)
		const stats = await ctx.db
			.query('projectStats')
			.withIndex('by_project', (q) => q.eq('projectId', project._id))
			.first()

		return {
			days,
			totals: {
				views: sum(days, (day) => day.views),
				downloads: sum(days, (day) => day.downloads),
				apiDownloads: sum(days, (day) => day.apiDownloads),
				saves: sum(days, (day) => day.saves),
				allTimeDownloads: stats?.totalDownloads ?? 0,
			},
			versions: versions
				.filter((version) => version.downloads > 0)
				.sort((a, b) => b.downloads - a.downloads)
				.map((version) => ({
					version: version.version,
					downloads: version.downloads,
				})),
		}
	},
})

/**
 * The plugin dashboard works with publishing drafts; analytics belong to the
 * plugin the draft published. Null until the draft has been published once.
 */
export const forPlugin = query({
	args: { draftId: v.id('pluginPublishingDrafts'), ...rangeArgs },
	returns: v.union(
		v.null(),
		v.object({
			days: v.array(downloadDay),
			totals: v.object({
				views: v.number(),
				downloads: v.number(),
				apiDownloads: v.number(),
			}),
		}),
	),
	handler: async (ctx, args) => {
		const draft = await ctx.db.get(args.draftId)
		if (!draft) throw new ConvexError('Plugin not found')
		await requireEditor(ctx, draft)
		const plugin = draft.projectId ? await ctx.db.get(draft.projectId) : null
		if (!plugin) return null
		await requireEditor(ctx, plugin)
		const range = resolveRange(args.endDay, args.days)

		const rows = await ctx.db
			.query('pluginDailyStats')
			.withIndex('by_pluginId_and_dayKey', (q) =>
				q
					.eq('pluginId', plugin._id)
					.gte('dayKey', range.startDay)
					.lte('dayKey', range.endDay),
			)
			.take(range.keys.length)
		const byDay = new Map(rows.map((row) => [row.dayKey, row]))
		const days = range.keys.map((day) => {
			const row = byDay.get(day)
			const downloads = row?.downloads ?? 0
			const apiDownloads = row?.apiDownloads ?? 0
			return {
				day,
				views: row?.views ?? 0,
				downloads,
				websiteDownloads: downloads - apiDownloads,
				apiDownloads,
			}
		})
		return {
			days,
			totals: {
				views: sum(days, (day) => day.views),
				downloads: sum(days, (day) => day.downloads),
				apiDownloads: sum(days, (day) => day.apiDownloads),
			},
		}
	},
})

export const forServer = query({
	args: { serverId: v.id('servers'), ...rangeArgs },
	returns: v.object({
		days: v.array(
			v.object({
				day: v.string(),
				views: v.number(),
				addressCopies: v.number(),
				// Null on days without a status check.
				averagePlayers: v.union(v.number(), v.null()),
				peakPlayers: v.union(v.number(), v.null()),
				uptime: v.union(v.number(), v.null()), // 0-1
			}),
		),
		totals: v.object({
			views: v.number(),
			addressCopies: v.number(),
			peakPlayers: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		const server = await ctx.db.get(args.serverId)
		if (!server) throw new ConvexError('Server not found')
		await requireEditor(ctx, server)
		const range = resolveRange(args.endDay, args.days)

		const rows = await ctx.db
			.query('serverDailyStats')
			.withIndex('by_serverId_and_dayKey', (q) =>
				q
					.eq('serverId', server._id)
					.gte('dayKey', range.startDay)
					.lte('dayKey', range.endDay),
			)
			.take(range.keys.length)
		const byDay = new Map(rows.map((row) => [row.dayKey, row]))
		const days = range.keys.map((day) => {
			const row = byDay.get(day)
			const checked = row !== undefined && row.checks > 0
			return {
				day,
				views: row?.views ?? 0,
				addressCopies: row?.addressCopies ?? 0,
				averagePlayers: checked
					? Math.round((row.playerSum / row.checks) * 10) / 10
					: null,
				peakPlayers: checked ? row.peakPlayers : null,
				uptime: checked ? row.checksOnline / row.checks : null,
			}
		})
		return {
			days,
			totals: {
				views: sum(days, (day) => day.views),
				addressCopies: sum(days, (day) => day.addressCopies),
				peakPlayers: Math.max(0, ...days.map((day) => day.peakPlayers ?? 0)),
			},
		}
	},
})
