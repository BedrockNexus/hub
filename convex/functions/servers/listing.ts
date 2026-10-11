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

interface Filters {
	categoryIds: Id<'serverCategories'>[]
	region?: string
	onlineOnly: boolean
	verifiedOnly: boolean
	softwareId?: Id<'serverSoftware'>
	gameVersion?: string
	minPlayers: number
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
	if (filters.region && server.region !== filters.region) {
		return false
	}
	if (filters.verifiedOnly && server.verifiedAt === undefined) {
		return false
	}
	if (filters.softwareId && server.softwareId !== filters.softwareId) {
		return false
	}
	if (
		filters.gameVersion &&
		!server.gameVersions?.includes(filters.gameVersion)
	) {
		return false
	}
	const isOnline = status?.online === true
	if ((filters.onlineOnly || filters.minPlayers > 0) && !isOnline) {
		return false
	}
	return (status?.playerCount ?? 0) >= filters.minPlayers
}

async function statsOf(ctx: QueryCtx, serverId: Id<'servers'>) {
	return await ctx.db
		.query('serverStats')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.first()
}

async function statusOf(ctx: QueryCtx, serverId: Id<'servers'>) {
	return await ctx.db
		.query('serverStatus')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.first()
}

async function imageUrl(key: string | undefined) {
	return key ? await resolveCdnObjectUrl(key, IMAGE_URL_EXPIRES_IN) : undefined
}

async function toCards(ctx: QueryCtx, rows: Row[]) {
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
			verified: server.verifiedAt !== undefined,
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
		region: v.optional(v.string()),
		onlineOnly: v.optional(v.boolean()),
		verifiedOnly: v.optional(v.boolean()),
		// Server software slug, as declared by the owner.
		software: v.optional(v.string()),
		// A Minecraft version the owner lists as supported, e.g. "1.21.80".
		gameVersion: v.optional(v.string()),
		// At least this many players online right now.
		minPlayers: v.optional(v.number()),
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
		const filters: Filters = {
			categoryIds: await categoryIdsFor(ctx, args.categories ?? []),
			region: args.region?.trim() || undefined,
			onlineOnly: args.onlineOnly === true,
			verifiedOnly: args.verifiedOnly === true,
			softwareId: software?._id,
			gameVersion: args.gameVersion?.trim() || undefined,
			minPlayers: Math.max(0, Math.floor(args.minPlayers ?? 0)),
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
			const { minPlayers, onlineOnly } = filters
			const result = await stream(ctx.db, schema)
				.query('serverStatus')
				.withIndex('by_isPublic_and_online_and_playerCount', (q) => {
					const listed = q.eq('isPublic', true)
					if (minPlayers > 0) {
						return listed
							.eq('online', true)
							.gte('playerCount', minPlayers)
					}
					return onlineOnly ? listed.eq('online', true) : listed
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
