import { v } from 'convex/values'
import { query } from '../../_generated/server'

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
