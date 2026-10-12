import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import {
	internalMutation,
	type MutationCtx,
	type QueryCtx,
	query,
} from '../../_generated/server'
import { isPublicProject, isPublicServer } from '../../lib/contentVisibility'
import { creatorRankScore } from '../../lib/creatorRank'

const MAX_QUERY_LENGTH = 100
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20

/**
 * Creators and organizations whose name, username or slug matches `query`,
 * best match first. Only those with something public to show are listed (see
 * lib/creatorListings.ts); banned accounts never are.
 */
export const search = query({
	args: {
		query: v.string(),
		ownerType: v.optional(
			v.union(v.literal('user'), v.literal('organization')),
		),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			ownerType: v.union(v.literal('user'), v.literal('organization')),
			slug: v.string(),
			name: v.string(),
			pictureUrl: v.optional(v.string()),
			serverCount: v.number(),
			projectCount: v.number(),
			pluginCount: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const text = args.query.trim().slice(0, MAX_QUERY_LENGTH)
		if (!text) {
			return []
		}
		const limit = Math.min(
			Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1),
			MAX_LIMIT,
		)
		const { ownerType } = args
		const [listings, features] = await Promise.all([
			ctx.db
				.query('creatorListings')
				.withSearchIndex('search_text', (q) => {
					const search = q.search('searchText', text)
					return ownerType ? search.eq('ownerType', ownerType) : search
				})
				// Room for the plugin-only owners dropped below.
				.take(limit * 2),
			ctx.db
				.query('siteSettings')
				.withIndex('by_key', (q) => q.eq('key', 'features'))
				.unique(),
		])
		const pluginsEnabled =
			(features?.value as { pluginsEnabled?: boolean } | undefined)
				?.pluginsEnabled === true

		return listings
			.filter(
				(listing) =>
					pluginsEnabled ||
					listing.serverCount + listing.projectCount > 0,
			)
			.slice(0, limit)
			.map((listing) => ({
				ownerType: listing.ownerType,
				slug: listing.slug,
				name: listing.name,
				pictureUrl: listing.pictureUrl,
				serverCount: listing.serverCount,
				projectCount: listing.projectCount,
				// Plugins stay out of sight while the feature is off.
				pluginCount: pluginsEnabled ? listing.pluginCount : 0,
			}))
	},
})

const SITEMAP_LIMIT = 2000

/** Public pages of creators and organizations that have something to show, for the sitemap. */
export const sitemapEntries = query({
	args: {},
	returns: v.array(
		v.object({
			ownerType: v.union(v.literal('user'), v.literal('organization')),
			slug: v.string(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx) => {
		const [users, organizations] = await Promise.all(
			(['user', 'organization'] as const).map((ownerType) =>
				ctx.db
					.query('creatorListings')
					.withIndex('by_ownerType_and_ownerId', (q) =>
						q.eq('ownerType', ownerType),
					)
					.take(SITEMAP_LIMIT),
			),
		)
		const features = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'features'))
			.unique()
		const pluginsEnabled =
			(features?.value as { pluginsEnabled?: boolean } | undefined)
				?.pluginsEnabled === true
		return [...users, ...organizations]
			.filter(
				(listing) =>
					pluginsEnabled ||
					listing.serverCount + listing.projectCount > 0,
			)
			.map((listing) => ({
				ownerType: listing.ownerType,
				slug: listing.slug,
				updatedAt: listing.updatedAt,
			}))
	},
})

const POPULAR_LIMIT = 60
const RANK_BATCH_SIZE = 25
// Per owner; matches the cap on the counts in lib/creatorListings.ts.
const RANK_ITEM_LIMIT = 500

async function pluginsAreEnabled(ctx: QueryCtx) {
	const features = await ctx.db
		.query('siteSettings')
		.withIndex('by_key', (q) => q.eq('key', 'features'))
		.unique()
	return (
		(features?.value as { pluginsEnabled?: boolean } | undefined)
			?.pluginsEnabled === true
	)
}

/**
 * The most active creators or organizations, best first, for /creators and
 * /organizations. Ordered by the hourly rank in lib/creatorRank.ts; owners
 * listed since the last refresh come last until it runs.
 */
export const listPopular = query({
	args: {
		ownerType: v.union(v.literal('user'), v.literal('organization')),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			slug: v.string(),
			name: v.string(),
			pictureUrl: v.optional(v.string()),
			serverCount: v.number(),
			projectCount: v.number(),
			pluginCount: v.number(),
			totalDownloads: v.number(),
			avgPlayers7d: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const limit = Math.min(
			Math.max(Math.floor(args.limit ?? POPULAR_LIMIT), 1),
			POPULAR_LIMIT,
		)
		const [listings, pluginsEnabled] = await Promise.all([
			ctx.db
				.query('creatorListings')
				.withIndex('by_ownerType_and_rankScore', (q) =>
					q.eq('ownerType', args.ownerType),
				)
				.order('desc')
				// Room for the plugin-only owners dropped below.
				.take(limit * 2),
			pluginsAreEnabled(ctx),
		])
		return listings
			.filter(
				(listing) =>
					pluginsEnabled ||
					listing.serverCount + listing.projectCount > 0,
			)
			.slice(0, limit)
			.map((listing) => ({
				slug: listing.slug,
				name: listing.name,
				pictureUrl: listing.pictureUrl,
				serverCount: listing.serverCount,
				projectCount: listing.projectCount,
				pluginCount: pluginsEnabled ? listing.pluginCount : 0,
				totalDownloads: listing.totalDownloads ?? 0,
				avgPlayers7d: listing.avgPlayers7d ?? 0,
			}))
	},
})

/** Public activity behind one listing's rank. */
async function measureActivity(ctx: MutationCtx, listing: Doc<'creatorListings'>) {
	const { ownerType, ownerId } = listing
	const [servers, projects, plugins] = await Promise.all([
		ownerType === 'user'
			? ctx.db
					.query('servers')
					.withIndex('by_registered_by', (q) =>
						q.eq('registeredBy', ownerId),
					)
					.take(RANK_ITEM_LIMIT)
			: ctx.db
					.query('servers')
					.withIndex('by_owner', (q) =>
						q.eq('ownerType', ownerType).eq('ownerId', ownerId),
					)
					.take(RANK_ITEM_LIMIT),
		ctx.db
			.query('projects')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', ownerType).eq('ownerId', ownerId),
			)
			.take(RANK_ITEM_LIMIT),
		ctx.db
			.query('plugins')
			.withIndex(
				'by_owner_type_and_owner_id_and_visibility_and_status',
				(q) =>
					q
						.eq('ownerType', ownerType)
						.eq('ownerId', ownerId)
						.eq('visibility', 'public')
						.eq('status', 'published'),
			)
			.take(RANK_ITEM_LIMIT),
	])
	const [serverStats, projectStats] = await Promise.all([
		Promise.all(
			servers.filter(isPublicServer).map((server) =>
				ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first(),
			),
		),
		Promise.all(
			projects.filter(isPublicProject).map((project) =>
				ctx.db
					.query('projectStats')
					.withIndex('by_project', (q) =>
						q.eq('projectId', project._id),
					)
					.first(),
			),
		),
	])
	const sum = (values: Array<number | undefined>) =>
		values.reduce((total: number, value) => total + (value ?? 0), 0)
	return {
		totalDownloads:
			sum(projectStats.map((stats) => stats?.totalDownloads)) +
			sum(plugins.map((plugin) => plugin.downloadCount)),
		avgPlayers7d:
			Math.round(sum(serverStats.map((stats) => stats?.avgPlayers7d)) * 10) /
			10,
		listings:
			listing.serverCount + listing.projectCount + listing.pluginCount,
	}
}

/**
 * Refreshes every listing's downloads, weekly players and rank, a batch at a
 * time (crons.ts: `recompute-creator-ranks`).
 */
export const recomputeRanks = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('creatorListings')
			.paginate({ cursor: args.cursor ?? null, numItems: RANK_BATCH_SIZE })
		for (const listing of page.page) {
			const activity = await measureActivity(ctx, listing)
			const rankScore = creatorRankScore(activity)
			if (
				listing.rankScore !== rankScore ||
				listing.totalDownloads !== activity.totalDownloads ||
				listing.avgPlayers7d !== activity.avgPlayers7d
			) {
				await ctx.db.patch('creatorListings', listing._id, {
					totalDownloads: activity.totalDownloads,
					avgPlayers7d: activity.avgPlayers7d,
					rankScore,
				})
			}
		}
		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.creators.recomputeRanks,
				{ cursor: page.continueCursor },
			)
		}
		return null
	},
})
