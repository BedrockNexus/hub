import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from '../../_generated/dataModel'
import {
	type MutationCtx,
	type QueryCtx,
	mutation,
	query,
} from '../../_generated/server'
import { authComponent } from '../../auth'
import { validateReview } from '../../lib/contentValidation'
import { replaceProjectAggregates } from '../../lib/plugins/aggregates'
import { getActiveOrganizationMembership } from '../../lib/plugins/authorization'
import { enforceRateLimit } from '../../lib/rateLimits'

/**
 * Plugin reviews, the same as project and server reviews: one per user and
 * plugin, editable, never by the plugin's own creators. The plugin keeps the
 * rounded average and count for listings and sorting.
 */

// Enough for any plugin's stats; a plugin with more reviews is counted from
// the newest ones.
const STATS_LIMIT = 2000

function isPublicPlugin(plugin: Doc<'plugins'> | null): plugin is Doc<'plugins'> {
	return plugin?.visibility === 'public' && plugin.status === 'published'
}

async function activeReviews(ctx: QueryCtx, pluginId: Id<'plugins'>) {
	return await ctx.db
		.query('pluginReviews')
		.withIndex('by_plugin_id_and_is_active', (q) =>
			q.eq('pluginId', pluginId).eq('isActive', true),
		)
		.order('desc')
		.take(STATS_LIMIT)
}

function statsOf(reviews: Doc<'pluginReviews'>[]) {
	const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
	let total = 0
	for (const review of reviews) {
		total += review.rating
		distribution[review.rating] = (distribution[review.rating] ?? 0) + 1
	}
	return {
		totalReviews: reviews.length,
		averageRating:
			reviews.length > 0 ? Math.round((total / reviews.length) * 10) / 10 : 0,
		distribution,
	}
}

export const list = query({
	args: {
		pluginId: v.id('plugins'),
		limit: v.optional(v.number()),
		sortBy: v.optional(v.union(v.literal('recent'), v.literal('rating'))),
	},
	handler: async (ctx, args) => {
		if (!isPublicPlugin(await ctx.db.get('plugins', args.pluginId))) {
			return []
		}
		const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 50)
		let reviews = await ctx.db
			.query('pluginReviews')
			.withIndex('by_plugin_id_and_is_active', (q) =>
				q.eq('pluginId', args.pluginId).eq('isActive', true),
			)
			.order('desc')
			.take(args.sortBy === 'rating' ? STATS_LIMIT : limit)
		if (args.sortBy === 'rating') {
			reviews = reviews
				.sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt)
				.slice(0, limit)
		}
		return await Promise.all(
			reviews.map(async (review) => {
				const user = await authComponent.getAnyUserById(ctx, review.userId)
				return {
					...review,
					user: user
						? {
								name: user.name,
								username: user.username ?? undefined,
								displayUsername: user.displayUsername ?? undefined,
								image: user.image ?? undefined,
							}
						: null,
				}
			}),
		)
	},
})

export const getUserReview = query({
	args: { pluginId: v.id('plugins') },
	handler: async (ctx, args) => {
		if (!isPublicPlugin(await ctx.db.get('plugins', args.pluginId))) {
			return null
		}
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) {
			return null
		}
		const review = await ctx.db
			.query('pluginReviews')
			.withIndex('by_plugin_id_and_user_id', (q) =>
				q.eq('pluginId', args.pluginId).eq('userId', user._id),
			)
			.unique()
		return review?.isActive ? review : null
	},
})

export const getStats = query({
	args: { pluginId: v.id('plugins') },
	handler: async (ctx, args) => {
		if (!isPublicPlugin(await ctx.db.get('plugins', args.pluginId))) {
			return statsOf([])
		}
		return statsOf(await activeReviews(ctx, args.pluginId))
	},
})

async function isPluginCreator(
	ctx: MutationCtx,
	plugin: Doc<'plugins'>,
	user: NonNullable<Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>>,
) {
	if (plugin.createdBy === user._id) {
		return true
	}
	return plugin.ownerType === 'user'
		? plugin.ownerId === user._id
		: Boolean(
				await getActiveOrganizationMembership(ctx, plugin.ownerId, user),
			)
}

async function refreshRating(ctx: MutationCtx, plugin: Doc<'plugins'>) {
	const stats = statsOf(await activeReviews(ctx, plugin._id))
	if (
		plugin.ratingAverage === stats.averageRating &&
		plugin.ratingCount === stats.totalReviews
	) {
		return
	}
	await ctx.db.patch('plugins', plugin._id, {
		ratingAverage: stats.averageRating,
		ratingCount: stats.totalReviews,
	})
	const updated = await ctx.db.get('plugins', plugin._id)
	if (updated) {
		await replaceProjectAggregates(ctx, plugin, updated)
	}
}

export const upsert = mutation({
	args: {
		pluginId: v.id('plugins'),
		rating: v.number(),
		content: v.optional(v.string()),
	},
	returns: v.id('pluginReviews'),
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) {
			throw new ConvexError('You must be logged in to review')
		}
		await enforceRateLimit(
			ctx,
			'reviewMutation',
			user._id,
			'Too many review changes. Please wait before trying again.',
		)
		validateReview(args.rating, args.content)
		const plugin = await ctx.db.get('plugins', args.pluginId)
		if (!isPublicPlugin(plugin)) {
			throw new ConvexError('This plugin is not available for reviews')
		}
		if (await isPluginCreator(ctx, plugin, user)) {
			throw new ConvexError('You cannot review your own plugin')
		}

		const now = Date.now()
		const content = args.content?.trim() || undefined
		const existing = await ctx.db
			.query('pluginReviews')
			.withIndex('by_plugin_id_and_user_id', (q) =>
				q.eq('pluginId', args.pluginId).eq('userId', user._id),
			)
			.unique()
		let reviewId: Id<'pluginReviews'>
		if (existing) {
			await ctx.db.patch('pluginReviews', existing._id, {
				rating: args.rating,
				content,
				// A deleted review written again is a new review, not an edit.
				isEdited: existing.isActive ? true : undefined,
				isActive: true,
				createdAt: existing.isActive ? existing.createdAt : now,
				updatedAt: now,
			})
			reviewId = existing._id
		} else {
			reviewId = await ctx.db.insert('pluginReviews', {
				pluginId: args.pluginId,
				userId: user._id,
				rating: args.rating,
				content,
				isActive: true,
				createdAt: now,
			})
		}
		await refreshRating(ctx, plugin)
		return reviewId
	},
})

export const remove = mutation({
	args: { id: v.id('pluginReviews') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) {
			throw new ConvexError('You must be logged in to delete reviews')
		}
		await enforceRateLimit(
			ctx,
			'reviewMutation',
			user._id,
			'Too many review changes. Please wait before trying again.',
		)
		const review = await ctx.db.get('pluginReviews', args.id)
		if (!review || review.userId !== user._id) {
			throw new ConvexError('You can only delete your own reviews')
		}
		await ctx.db.patch('pluginReviews', review._id, { isActive: false })
		const plugin = await ctx.db.get('plugins', review.pluginId)
		if (plugin) {
			await refreshRating(ctx, plugin)
		}
		return null
	},
})
