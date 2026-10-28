import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { stream } from 'convex-helpers/server/stream'
import type { Doc, Id } from '../../_generated/dataModel'
import { type QueryCtx, query } from '../../_generated/server'
import { isPublicServer } from '../../lib/contentVisibility'
import { resolveCdnObjectUrl } from '../../lib/r2'
import schema from '../../schema'

/**
 * The public server listing behind /servers.
 *
 * "Most players" reads `serverStatus` in index order (online first, busiest
 * first); every other sort reads `serverStats` in its own index order. The
 * listing fields on both are kept by lib/discovery.ts and the status checks.
 * A server joins "Most players" with its first status check, which is
 * scheduled as soon as it is listed.
 *
 * Searching reads the `search_text` index on `servers` instead; results come
 * back by relevance and `sort` is ignored.
 *
 * Filters that no index covers are applied to the rows as they are read, up
 * to MAX_ROWS_PER_PAGE per request. A page can therefore come back short, or
 * empty, while `isDone` is still false; callers keep loading until it is true.
 */

const MAX_PAGE_SIZE = 48
const MAX_ROWS_PER_PAGE = 300
const MAX_QUERY_LENGTH = 100
const MAX_CATEGORY_FILTERS = 20
const MAX_VALUE_FILTERS = 20
const IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

const sortValidator = v.union(
	v.literal('players'),
	v.literal('trending'),
	v.literal('rating'),
	v.literal('newest'),
	v.literal('saved'),
)

const STATS_SORT_INDEX = {
	trending: 'by_isPublic_and_trendingScore',
	rating: 'by_isPublic_and_averageRating',
	newest: 'by_isPublic_and_publishedAt',
	saved: 'by_isPublic_and_favouriteCount',
} as const

const statusValidator = v.union(v.literal('online'), v.literal('offline'))

interface Filters {
	categoryIds: Id<'serverCategories'>[]
	regions: string[]
	// Online or offline; empty, or both, keeps every server.
	online?: boolean
	softwareId?: Id<'serverSoftware'>
	gameVersions: string[]
}

interface Row {
	server: Doc<'servers'>
	stats: Doc<'serverStats'> | null
	status: Doc<'serverStatus'> | null
}

/** Everything the listing checks on the server and its live status. */
function matchesFilters({ server, status }: Row, filters: Filters) {
	if (!isPublicServer(server)) {
		return false
	}
	if (
		filters.categoryIds.length > 0 &&
		!filters.categoryIds.some((id) => server.categoryIds.includes(id))
	) {
		return false
	}
	if (
		filters.regions.length > 0 &&
		!(server.region && filters.regions.includes(server.region))
	) {
		return false
	}
	if (filters.softwareId && server.softwareId !== filters.softwareId) {
		return false
	}
	if (
		filters.gameVersions.length > 0 &&
		!filters.gameVersions.some((version) =>
			server.gameVersions?.includes(version),
		)
	) {
		return false
	}
	return (
		filters.online === undefined ||
		(status?.online === true) === filters.online
	)
}

/** Distinct, trimmed values from the page URL. */
function cleanValues(values: string[] | undefined) {
	return [
		...new Set(
			(values ?? []).map((value) => value.trim()).filter(Boolean),
		),
	].slice(0, MAX_VALUE_FILTERS)
}

export async function statsOf(ctx: QueryCtx, serverId: Id<'servers'>) {
	return await ctx.db
		.query('serverStats')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.first()
}

export async function statusOf(ctx: QueryCtx, serverId: Id<'servers'>) {
	return await ctx.db
		.query('serverStatus')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.first()
}

async function imageUrl(key: string | undefined) {
	return key ? await resolveCdnObjectUrl(key, IMAGE_URL_EXPIRES_IN) : undefined
}

/** The shape every public server card and row is drawn from. */
export async function toCards(ctx: QueryCtx, rows: Row[]) {
	const categoryIds = [
		...new Set(rows.flatMap((row) => row.server.categoryIds)),
	]
	const categories = new Map(
		(
			await Promise.all(
				categoryIds.map((id) => ctx.db.get('serverCategories', id)),
			)
		).flatMap((category) =>
			category ? [[category._id, category] as const] : [],
		),
	)
	return await Promise.all(
		rows.map(async ({ server, stats, status }) => ({
			...server,
			logoUrl: await imageUrl(server.logoR2Key),
			bannerUrl: await imageUrl(server.bannerR2Key),
			categories: server.categoryIds.flatMap((id) => {
				const category = categories.get(id)
				return category ? [category] : []
			}),
			online: status?.online,
			playerCount: status?.playerCount ?? 0,
			maxPlayers: status?.maxPlayers,
			averageRating: stats?.averageRating ?? 0,
			reviewCount: stats?.reviewCount ?? 0,
			favouriteCount: stats?.favouriteCount ?? 0,
		})),
	)
}

/** Category slugs from the page URL; unknown ones are ignored. */
async function categoryIdsFor(ctx: QueryCtx, slugs: string[]) {
	const categories = await Promise.all(
		slugs.slice(0, MAX_CATEGORY_FILTERS).map((slug) =>
			ctx.db
				.query('serverCategories')
				.withIndex('by_slug', (q) => q.eq('slug', slug))
				.first(),
		),
	)
	return categories.flatMap((category) => (category ? [category._id] : []))
}

export const browse = query({
	args: {
		paginationOpts: paginationOptsValidator,
		query: v.optional(v.string()),
		sort: v.optional(sortValidator),
		// Any of these gamemodes, by slug.
		categories: v.optional(v.array(v.string())),
		// Any of these regions.
		regions: v.optional(v.array(v.string())),
		// Any of these live statuses.
		status: v.optional(v.array(statusValidator)),
		// Server software slug, as declared by the owner.
		software: v.optional(v.string()),
		// Any of these Minecraft versions the owner lists as supported,
		// e.g. "1.21.80".
		gameVersions: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const paginationOpts = {
			...args.paginationOpts,
			numItems: Math.min(
				Math.max(Math.floor(args.paginationOpts.numItems), 1),
				MAX_PAGE_SIZE,
			),
		}
		const softwareSlug = args.software?.trim()
		const software = softwareSlug
			? await ctx.db
					.query('serverSoftware')
					.withIndex('by_slug', (q) => q.eq('slug', softwareSlug))
					.unique()
			: null
		if (softwareSlug && !software) {
			// Nothing can declare software that does not exist.
			return { page: [], isDone: true, continueCursor: '' }
		}
		const status = new Set(args.status ?? [])
		const filters: Filters = {
			categoryIds: await categoryIdsFor(ctx, args.categories ?? []),
			regions: cleanValues(args.regions),
			online: status.size === 1 ? status.has('online') : undefined,
			softwareId: software?._id,
			gameVersions: cleanValues(args.gameVersions),
		}
		const keep = (row: Row) => (matchesFilters(row, filters) ? row : null)
		const text = args.query?.trim().slice(0, MAX_QUERY_LENGTH)

		if (text) {
			const { softwareId } = filters
			const result = await ctx.db
				.query('servers')
				.withSearchIndex('search_text', (q) => {
					const search = q
						.search('searchText', text)
						.eq('status', 'published')
					return softwareId
						? search.eq('softwareId', softwareId)
						: search
				})
				.paginate(paginationOpts)
			const rows = await Promise.all(
				result.page.map(async (server) => ({
					server,
					stats: await statsOf(ctx, server._id),
					status: await statusOf(ctx, server._id),
				})),
			)
			return {
				...result,
				page: await toCards(
					ctx,
					rows.filter((row) => matchesFilters(row, filters)),
				),
			}
		}

		const sort = args.sort ?? 'players'
		const limits = { ...paginationOpts, maximumRowsRead: MAX_ROWS_PER_PAGE }

		if (sort === 'players') {
			const { online } = filters
			const result = await stream(ctx.db, schema)
				.query('serverStatus')
				.withIndex('by_isPublic_and_online_and_playerCount', (q) => {
					const listed = q.eq('isPublic', true)
					return online === undefined
						? listed
						: listed.eq('online', online)
				})
				.order('desc')
				.map(async (status): Promise<Row | null> => {
					const server = await ctx.db.get('servers', status.serverId)
					return server
						? keep({
								server,
								status,
								stats: await statsOf(ctx, server._id),
							})
						: null
				})
				.paginate(limits)
			return { ...result, page: await toCards(ctx, result.page) }
		}

		const result = await stream(ctx.db, schema)
			.query('serverStats')
			.withIndex(STATS_SORT_INDEX[sort], (q) => q.eq('isPublic', true))
			.order('desc')
			.map(async (stats): Promise<Row | null> => {
				const server = await ctx.db.get('servers', stats.serverId)
				return server
					? keep({
							server,
							stats,
							status: await statusOf(ctx, server._id),
						})
					: null
			})
			.paginate(limits)
		return { ...result, page: await toCards(ctx, result.page) }
	},
})

const SITEMAP_LIMIT = 2000

/** Address and last change of every listed server, newest first, for the sitemap. */
export const sitemapEntries = query({
	args: {},
	returns: v.array(v.object({ slug: v.string(), updatedAt: v.number() })),
	handler: async (ctx) => {
		const listed = await ctx.db
			.query('serverStats')
			.withIndex('by_isPublic_and_publishedAt', (q) =>
				q.eq('isPublic', true),
			)
			.order('desc')
			.take(SITEMAP_LIMIT)
		const servers = await Promise.all(
			listed.map((stats) => ctx.db.get('servers', stats.serverId)),
		)
		return servers.flatMap((server) =>
			server && isPublicServer(server)
				? [
						{
							slug: server.slug,
							updatedAt: server.updatedAt ?? server._creationTime,
						},
					]
				: [],
		)
	},
})
