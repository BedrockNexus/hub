import { ConvexError, v } from 'convex/values'
import { components } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import {
	internalMutation,
	type MutationCtx,
	type QueryCtx,
} from '../../_generated/server'
import { backgroundJobsPaused } from '../../lib/backgroundJobs'
import { dayKeysEndingAt, isDayKey, recentDayKeys } from '../../lib/dayKeys'
import { adminQuery } from '../../lib/functions'

/**
 * Site-wide analytics for the admin analytics page.
 *
 * `rollup` runs hourly and folds the per-item daily counters
 * (projectDailyStats, pluginDailyStats, serverDailyStats) and the day's new
 * accounts, listings, reviews and follows into one siteDailyStats row per UTC
 * day. The admin page then reads one row per day. Like creator analytics,
 * nothing here is read from OpenPanel.
 */

const DAY_MS = 24 * 60 * 60 * 1000
// A day's per-item rows: one per item that had activity. Far above today's
// catalog; past this the totals undercount rather than fail.
const MAX_ROWS_PER_DAY = 4000
const MAX_CREATED_PER_DAY = 2000
const TOP_PER_SECTION = 10
const MAX_BACKFILL_DAYS = 120

type Section = 'project' | 'plugin' | 'server'

interface TopEntry {
	section: Section
	id: string
	views: number
	downloads: number
	addressCopies: number
}

function engagement(entry: TopEntry) {
	return entry.views + entry.downloads + entry.addressCopies
}

function topEntries(entries: TopEntry[]) {
	const sections: Section[] = ['project', 'plugin', 'server']
	return sections.flatMap((section) =>
		entries
			.filter((entry) => entry.section === section && engagement(entry) > 0)
			.sort((a, b) => engagement(b) - engagement(a))
			.slice(0, TOP_PER_SECTION),
	)
}

async function countCreated(
	ctx: MutationCtx,
	table:
		| 'servers'
		| 'projects'
		| 'plugins'
		| 'serverReviews'
		| 'projectReviews'
		| 'pluginReviews'
		| 'follows',
	start: number,
	end: number,
) {
	const rows = await ctx.db
		.query(table)
		.withIndex('by_creation_time', (q) =>
			q.gte('_creationTime', start).lt('_creationTime', end),
		)
		.take(MAX_CREATED_PER_DAY)
	return rows.length
}

/** Better Auth users or organizations created in [start, end). */
async function countAuthCreated(
	ctx: MutationCtx,
	model: 'user' | 'organization',
	start: number,
	end: number,
) {
	let count = 0
	let cursor: string | null = null
	for (let page = 0; page < 10; page += 1) {
		const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model,
			where: [
				{ field: 'createdAt', operator: 'gte', value: start },
				{ field: 'createdAt', operator: 'lt', value: end },
			],
			paginationOpts: { cursor, numItems: 200 },
		})) as { page?: unknown[]; isDone?: boolean; continueCursor?: string }
		count += result.page?.length ?? 0
		if (result.isDone ?? true) break
		cursor = result.continueCursor ?? null
	}
	return count
}

async function rollupDay(ctx: MutationCtx, dayKey: string, now: number) {
	const start = Date.parse(`${dayKey}T00:00:00Z`)
	const end = start + DAY_MS
	const [projectRows, pluginRows, serverRows] = await Promise.all([
		ctx.db
			.query('projectDailyStats')
			.withIndex('by_dayKey', (q) => q.eq('dayKey', dayKey))
			.take(MAX_ROWS_PER_DAY),
		ctx.db
			.query('pluginDailyStats')
			.withIndex('by_dayKey', (q) => q.eq('dayKey', dayKey))
			.take(MAX_ROWS_PER_DAY),
		ctx.db
			.query('serverDailyStats')
			.withIndex('by_dayKey', (q) => q.eq('dayKey', dayKey))
			.take(MAX_ROWS_PER_DAY),
	])
	const [
		signups,
		newOrganizations,
		newServers,
		newProjects,
		newPlugins,
		serverReviews,
		projectReviews,
		pluginReviews,
		follows,
	] = await Promise.all([
		countAuthCreated(ctx, 'user', start, end),
		countAuthCreated(ctx, 'organization', start, end),
		countCreated(ctx, 'servers', start, end),
		countCreated(ctx, 'projects', start, end),
		countCreated(ctx, 'plugins', start, end),
		countCreated(ctx, 'serverReviews', start, end),
		countCreated(ctx, 'projectReviews', start, end),
		countCreated(ctx, 'pluginReviews', start, end),
		countCreated(ctx, 'follows', start, end),
	])

	let projectViews = 0
	let pluginViews = 0
	let serverViews = 0
	let downloads = 0
	let apiDownloads = 0
	let addressCopies = 0
	let avgPlayers = 0
	let serversChecked = 0
	const entries: TopEntry[] = []
	for (const row of projectRows) {
		projectViews += row.views ?? 0
		downloads += row.downloads
		apiDownloads += row.apiDownloads ?? 0
		entries.push({
			section: 'project',
			id: row.projectId,
			views: row.views ?? 0,
			downloads: row.downloads,
			addressCopies: 0,
		})
	}
	for (const row of pluginRows) {
		pluginViews += row.views
		downloads += row.downloads
		apiDownloads += row.apiDownloads
		entries.push({
			section: 'plugin',
			id: row.pluginId,
			views: row.views,
			downloads: row.downloads,
			addressCopies: 0,
		})
	}
	for (const row of serverRows) {
		serverViews += row.views ?? 0
		addressCopies += row.addressCopies ?? 0
		if (row.checks > 0) {
			serversChecked += 1
			avgPlayers += row.playerSum / row.checks
		}
		entries.push({
			section: 'server',
			id: row.serverId,
			views: row.views ?? 0,
			downloads: 0,
			addressCopies: row.addressCopies ?? 0,
		})
	}

	const values = {
		dayKey,
		projectViews,
		pluginViews,
		serverViews,
		downloads,
		apiDownloads,
		addressCopies,
		avgPlayers: Math.round(avgPlayers * 10) / 10,
		serversChecked,
		signups,
		newServers,
		newProjects,
		newPlugins,
		newOrganizations,
		reviews: serverReviews + projectReviews + pluginReviews,
		follows,
		top: topEntries(entries),
		updatedAt: now,
	}
	const existing = await ctx.db
		.query('siteDailyStats')
		.withIndex('by_dayKey', (q) => q.eq('dayKey', dayKey))
		.unique()
	if (existing) {
		await ctx.db.replace('siteDailyStats', existing._id, values)
	} else {
		await ctx.db.insert('siteDailyStats', values)
	}
}

/**
 * Rewrites today's and yesterday's rows (yesterday's counters can still move
 * for a few minutes after midnight). Pass `days` to rebuild further back, e.g.
 * once after deploying: `npx convex run functions/site/siteAnalytics:rollup
 * '{"days": 90}'`.
 */
export const rollup = internalMutation({
	args: { days: v.optional(v.number()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		if (args.days === undefined && backgroundJobsPaused()) {
			return null
		}
		const now = Date.now()
		const count = Math.min(
			MAX_BACKFILL_DAYS,
			Math.max(1, Math.floor(args.days ?? 2)),
		)
		for (const dayKey of recentDayKeys(now, count)) {
			await rollupDay(ctx, dayKey, now)
		}
		return null
	},
})

// =============================================================================
// ADMIN PAGE
// =============================================================================

const MIN_DAYS = 7
const MAX_DAYS = 90

const EMPTY_DAY = {
	projectViews: 0,
	pluginViews: 0,
	serverViews: 0,
	downloads: 0,
	apiDownloads: 0,
	addressCopies: 0,
	avgPlayers: 0,
	serversChecked: 0,
	signups: 0,
	newServers: 0,
	newProjects: 0,
	newPlugins: 0,
	newOrganizations: 0,
	reviews: 0,
	follows: 0,
}

type DayTotals = typeof EMPTY_DAY

function totalsOf(rows: readonly DayTotals[]): DayTotals {
	const totals = { ...EMPTY_DAY }
	for (const row of rows) {
		for (const key of Object.keys(totals) as (keyof DayTotals)[]) {
			totals[key] += row[key]
		}
	}
	// Players are an average per day, so the period figure is their mean.
	totals.avgPlayers =
		rows.length > 0
			? Math.round((totals.avgPlayers / rows.length) * 10) / 10
			: 0
	return totals
}

function dayTotals(row: Doc<'siteDailyStats'> | undefined): DayTotals {
	if (!row) return { ...EMPTY_DAY }
	const { _id, _creationTime, dayKey, top, updatedAt, ...totals } = row
	return totals
}

async function resolveTop(
	ctx: QueryCtx,
	entries: TopEntry[],
) {
	const merged = new Map<string, TopEntry>()
	for (const entry of entries) {
		const key = `${entry.section}:${entry.id}`
		const current = merged.get(key)
		if (current) {
			current.views += entry.views
			current.downloads += entry.downloads
			current.addressCopies += entry.addressCopies
		} else {
			merged.set(key, { ...entry })
		}
	}
	const top = topEntries([...merged.values()])
	const resolved = await Promise.all(
		top.map(async (entry) => {
			const counts = {
				key: `${entry.section}:${entry.id}`,
				views: entry.views,
				downloads: entry.downloads,
				addressCopies: entry.addressCopies,
			}
			if (entry.section === 'project') {
				const id = ctx.db.normalizeId('projects', entry.id)
				const project = id ? await ctx.db.get('projects', id) : null
				return project
					? {
							section: 'project' as const,
							name: project.name,
							project: {
								type: project.type,
								slug: project.slug,
								id: project._id,
								publicId: project.publicId,
							},
							...counts,
						}
					: null
			}
			if (entry.section === 'plugin') {
				const id = ctx.db.normalizeId('plugins', entry.id)
				const plugin = id ? await ctx.db.get('plugins', id) : null
				return plugin
					? {
							section: 'plugin' as const,
							name: plugin.name,
							plugin: { slug: plugin.slug },
							...counts,
						}
					: null
			}
			const id = ctx.db.normalizeId('servers', entry.id)
			const server = id ? await ctx.db.get('servers', id) : null
			return server
				? {
						section: 'server' as const,
						name: server.name,
						server: { ipAddress: server.ipAddress, port: server.port },
						...counts,
					}
				: null
		}),
	)
	return resolved.flatMap((item) => (item ? [item] : []))
}

/**
 * The admin analytics page: one entry per day in the range (oldest first,
 * zeros where no row exists), totals for the range and the one before it, the
 * busiest items, and the live homepage counters. Queries cannot read the
 * clock, so the caller passes the last UTC day to show.
 */
export const overview = adminQuery({
	args: { endDay: v.string(), days: v.number() },
	handler: async (ctx, args) => {
		if (!isDayKey(args.endDay)) {
			throw new ConvexError('endDay must be a UTC date like 2026-11-09')
		}
		const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.floor(args.days)))
		const keys = dayKeysEndingAt(args.endDay, days * 2)
		const previousKeys = keys.slice(0, days)
		const currentKeys = keys.slice(days)
		const [rows, aggregates] = await Promise.all([
			ctx.db
				.query('siteDailyStats')
				.withIndex('by_dayKey', (q) =>
					q.gte('dayKey', keys[0]).lte('dayKey', args.endDay),
				)
				.take(days * 2),
			ctx.db
				.query('siteAggregates')
				.withIndex('by_key', (q) => q.eq('key', 'home'))
				.unique(),
		])
		const byDay = new Map(rows.map((row) => [row.dayKey, row]))
		const series = currentKeys.map((day) => ({
			day,
			...dayTotals(byDay.get(day)),
		}))
		const previous = previousKeys.map((day) => dayTotals(byDay.get(day)))
		const currentRows = currentKeys.flatMap((day) => {
			const row = byDay.get(day)
			return row ? [row] : []
		})
		return {
			series,
			totals: totalsOf(series),
			previousTotals: totalsOf(previous),
			hasPreviousData: previousKeys.some((day) => byDay.has(day)),
			top: await resolveTop(
				ctx,
				currentRows.flatMap((row) => row.top),
			),
			live: aggregates
				? {
						servers: aggregates.servers,
						onlinePlayers: aggregates.onlinePlayers,
						projects: aggregates.projects,
						plugins: aggregates.plugins ?? 0,
						updatedAt: aggregates.updatedAt,
					}
				: null,
			rolledUpAt:
				currentRows.reduce(
					(latest, row) => Math.max(latest, row.updatedAt),
					0,
				) || null,
		}
	},
})
