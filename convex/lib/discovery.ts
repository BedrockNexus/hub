import { normalizeProjectType } from '../../lib/project-artifacts'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isPublicProject, isPublicServer } from './contentVisibility'
import { utcDayKey, utcMonthKey } from './dayKeys'

/**
 * Keeps the fields that public listings sort and filter on in step with the
 * documents they describe.
 *
 * Listings read `projectStats`, `serverStats` and `serverStatus` in index
 * order, so every write that can change whether something is public, what it
 * is, or how it ranks must go through here:
 *
 * - any server or project write        -> syncServer / syncProject
 *   (called from lib/activity.ts afterServerWrite / afterProjectWrite)
 * - a release becoming public or not   -> syncProject
 *   (called from updateProjectReleaseSummary)
 * - a save or unsave                   -> adjust*Favourites
 * - a counted download                 -> recordProjectDownload
 * - a status check                     -> recordServerCheck
 *
 * Fields added after content already existed stay undefined until
 * functions/site/migrations:backfillDiscovery has run.
 */

const SEARCH_TEXT_MAX = 2000

/** Patches only what differs, so unchanged documents never invalidate queries. */
async function patchChanged<T extends 'projectStats' | 'serverStats' | 'serverStatus'>(
	ctx: MutationCtx,
	doc: Doc<T>,
	next: Partial<Doc<T>>,
) {
	const current = doc as Record<string, unknown>
	const changed = Object.entries(next).filter(
		([field, value]) => current[field] !== value,
	)
	if (changed.length === 0) return
	await ctx.db.patch(doc._id, Object.fromEntries(changed) as Partial<Doc<T>>)
}

function buildSearchText(parts: ReadonlyArray<string | undefined>) {
	return parts
		.filter((part): part is string => Boolean(part?.trim()))
		.join(' ')
		.slice(0, SEARCH_TEXT_MAX)
}

// =============================================================================
// STATS DOCUMENTS
// =============================================================================

/** The project's stats document, created on first use. */
export async function ensureProjectStats(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
): Promise<Doc<'projectStats'>> {
	const existing = await ctx.db
		.query('projectStats')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.first()
	if (existing) return existing

	const id = await ctx.db.insert('projectStats', {
		projectId,
		totalDownloads: 0,
		averageRating: 0,
		reviewCount: 0,
		favouriteCount: 0,
		downloads7d: 0,
		trendingScore: 0,
		updatedAt: Date.now(),
	})
	const created = await ctx.db.get(id)
	if (!created) throw new Error('Could not create project stats')
	return created
}

/** The server's stats document, created on first use. */
export async function ensureServerStats(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
): Promise<Doc<'serverStats'>> {
	const existing = await ctx.db
		.query('serverStats')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.first()
	if (existing) return existing

	const now = Date.now()
	const id = await ctx.db.insert('serverStats', {
		serverId,
		totalIpCopies: 0,
		totalIpCopiesToday: 0,
		totalIpCopiesThisMonth: 0,
		dailyKey: utcDayKey(now),
		monthlyKey: utcMonthKey(now),
		averageRating: 0,
		reviewCount: 0,
		favouriteCount: 0,
		avgPlayers7d: 0,
		peakPlayers7d: 0,
		uptime7d: 0,
		trendingScore: 0,
		updatedAt: now,
	})
	const created = await ctx.db.get(id)
	if (!created) throw new Error('Could not create server stats')
	return created
}

// =============================================================================
// PROJECTS
// =============================================================================

/** Copies a project's listing fields to its stats and refreshes its search text. */
export async function syncProject(ctx: MutationCtx, project: Doc<'projects'>) {
	const stats = await ensureProjectStats(ctx, project._id)
	await patchChanged(ctx, stats, {
		isPublic: isPublicProject(project),
		type: normalizeProjectType(project.type),
		publishedAt: project.publishedAt,
		lastReleaseAt: project.latestVersionAt,
	})

	const categories = await Promise.all(
		project.categoryIds.map((id) => ctx.db.get(id)),
	)
	const searchText = buildSearchText([
		project.name,
		project.summary,
		...(project.tags ?? []),
		...categories.map((category) => category?.name),
	])
	if (searchText !== project.searchText) {
		await ctx.db.patch(project._id, { searchText })
	}
}

async function adjustProjectDay(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
	change: { downloads?: number; favourites?: number },
) {
	const dayKey = utcDayKey(Date.now())
	const day = await ctx.db
		.query('projectDailyStats')
		.withIndex('by_projectId_and_dayKey', (q) =>
			q.eq('projectId', projectId).eq('dayKey', dayKey),
		)
		.unique()
	if (day) {
		await ctx.db.patch(day._id, {
			downloads: day.downloads + (change.downloads ?? 0),
			favourites: day.favourites + (change.favourites ?? 0),
		})
		return
	}
	await ctx.db.insert('projectDailyStats', {
		projectId,
		dayKey,
		downloads: change.downloads ?? 0,
		favourites: change.favourites ?? 0,
	})
}

/** Adds one counted download to today's activity for the project. */
export async function recordProjectDownload(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
) {
	await adjustProjectDay(ctx, projectId, { downloads: 1 })
}

/** Call after the favourite row was inserted (+1) or deleted (-1). */
export async function adjustProjectFavourites(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
	delta: 1 | -1,
) {
	const stats = await ensureProjectStats(ctx, projectId)
	// Not counted yet for content older than this field: count once, exactly.
	const favouriteCount =
		stats.favouriteCount === undefined
			? (
					await ctx.db
						.query('favourites')
						.withIndex('by_project', (q) => q.eq('projectId', projectId))
						.collect()
				).length
			: Math.max(0, stats.favouriteCount + delta)
	await ctx.db.patch(stats._id, { favouriteCount })
	await adjustProjectDay(ctx, projectId, { favourites: delta })
}

// =============================================================================
// SERVERS
// =============================================================================

/** Copies a server's listing fields to its stats and status, and refreshes its search text. */
export async function syncServer(ctx: MutationCtx, server: Doc<'servers'>) {
	const isPublic = isPublicServer(server)
	const stats = await ensureServerStats(ctx, server._id)
	await patchChanged(ctx, stats, {
		isPublic,
		softwareId: server.softwareId,
		publishedAt: server.publishedAt,
	})

	const status = await ctx.db
		.query('serverStatus')
		.withIndex('by_server', (q) => q.eq('serverId', server._id))
		.first()
	if (status) {
		await patchChanged(ctx, status, { isPublic })
	}

	const [categories, software] = await Promise.all([
		Promise.all(server.categoryIds.map((id) => ctx.db.get(id))),
		server.softwareId ? ctx.db.get(server.softwareId) : null,
	])
	const searchText = buildSearchText([
		server.name,
		server.smallDescription,
		...(server.tags ?? []),
		...categories.map((category) => category?.name),
		software?.name,
		server.region,
	])
	if (searchText !== server.searchText) {
		await ctx.db.patch(server._id, { searchText })
	}
}

/** Call after the favourite row was inserted (+1) or deleted (-1). */
export async function adjustServerFavourites(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
	delta: 1 | -1,
) {
	const stats = await ensureServerStats(ctx, serverId)
	const favouriteCount =
		stats.favouriteCount === undefined
			? (
					await ctx.db
						.query('favourites')
						.withIndex('by_server', (q) => q.eq('serverId', serverId))
						.collect()
				).length
			: Math.max(0, stats.favouriteCount + delta)
	await ctx.db.patch(stats._id, { favouriteCount })
}

/** Adds one status check to the server's totals for that UTC day. */
export async function recordServerCheck(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
	check: {
		checkedAt: number
		online: boolean
		playerCount: number
		latency?: number
	},
) {
	const dayKey = utcDayKey(check.checkedAt)
	const players = check.online ? check.playerCount : 0
	const hasLatency = check.online && check.latency !== undefined
	const day = await ctx.db
		.query('serverDailyStats')
		.withIndex('by_serverId_and_dayKey', (q) =>
			q.eq('serverId', serverId).eq('dayKey', dayKey),
		)
		.unique()

	if (day) {
		await ctx.db.patch(day._id, {
			checks: day.checks + 1,
			checksOnline: day.checksOnline + (check.online ? 1 : 0),
			playerSum: day.playerSum + players,
			peakPlayers: Math.max(day.peakPlayers, players),
			latencySum: day.latencySum + (hasLatency ? (check.latency ?? 0) : 0),
			latencySamples: day.latencySamples + (hasLatency ? 1 : 0),
		})
		return
	}
	await ctx.db.insert('serverDailyStats', {
		serverId,
		dayKey,
		checks: 1,
		checksOnline: check.online ? 1 : 0,
		playerSum: players,
		peakPlayers: players,
		latencySum: hasLatency ? (check.latency ?? 0) : 0,
		latencySamples: hasLatency ? 1 : 0,
	})
}
