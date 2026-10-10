import { v } from 'convex/values'
import type { MutationCtx } from '../../_generated/server'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import type { Doc, Id } from '../../_generated/dataModel'
import { validateReview } from '../../lib/contentValidation'
import { isPublicServer } from '../../lib/contentVisibility'
import { isAffiliatedWithContent } from '../../lib/permissions'
import { enforceRateLimit } from '../../lib/rateLimits'
import { recordActivity } from '../../lib/activity'
import { ensureServerStats } from '../../lib/discovery'

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get reviews for a server
 */
export const list = query({
	args: {
		serverId: v.id('servers'),
		limit: v.optional(v.number()),
		sortBy: v.optional(v.union(v.literal('recent'), v.literal('rating'))),
	},
	handler: async (ctx, args) => {
		const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 50)
		const sortBy = args.sortBy ?? 'recent'

		let reviews: Doc<'serverReviews'>[]

		if (sortBy === 'rating') {
			reviews = await ctx.db
				.query('serverReviews')
				.withIndex('by_server_rating', (q) =>
					q.eq('serverId', args.serverId),
				)
				.filter((q) => q.eq(q.field('isActive'), true))
				.order('desc')
				.take(limit)
		} else {
			// Recent (default)
			reviews = await ctx.db
				.query('serverReviews')
				.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
				.filter((q) => q.eq(q.field('isActive'), true))
				.order('desc')
				.take(limit)
		}

		// Fetch user data for each review
		const reviewsWithUsers = await Promise.all(
			reviews.map(async (review) => {
				const user = await authComponent.getAnyUserById(
					ctx,
					review.userId,
				)
				return {
					...review,
					user: user
						? {
								name: user.name,
								username: user.username ?? undefined,
								displayUsername:
									user.displayUsername ?? undefined,
								image: user.image ?? undefined,
							}
						: null,
				}
			}),
		)

		return reviewsWithUsers
	},
})

/**
 * Get a user's review for a server
 */
export const getUserReview = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) return null

		return await ctx.db
			.query('serverReviews')
			.withIndex('by_server_user', (q) =>
				q.eq('serverId', args.serverId).eq('userId', user._id),
			)
			.first()
	},
})

/**
 * Get review stats for a server
 */
export const getStats = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const reviews = await ctx.db
			.query('serverReviews')
			.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
			.filter((q) => q.eq(q.field('isActive'), true))
			.collect()

		if (reviews.length === 0) {
			return {
				totalReviews: 0,
				averageRating: 0,
				distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
			}
		}

		const distribution: Record<number, number> = {
			1: 0,
			2: 0,
			3: 0,
			4: 0,
			5: 0,
		}
		let totalRating = 0

		for (const review of reviews) {
			totalRating += review.rating
			distribution[review.rating] = (distribution[review.rating] || 0) + 1
		}

		return {
			totalReviews: reviews.length,
			averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
			distribution,
		}
	},
})

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create or update a review
 */
export const upsert = mutation({
	args: {
		serverId: v.id('servers'),
		rating: v.number(),
		content: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to review')
		}
		await enforceRateLimit(
			ctx,
			'reviewMutation',
			user._id,
			'Too many review changes. Please wait before trying again.',
		)

		validateReview(args.rating, args.content)
		const server = await ctx.db.get(args.serverId)
		if (!server || !isPublicServer(server)) {
			throw new Error('This server is not available for reviews')
		}
		if (await isAffiliatedWithContent(ctx, server, user._id)) {
			throw new Error('You cannot review your own server')
		}

		const now = Date.now()

		// Check for existing review
		const existing = await ctx.db
			.query('serverReviews')
			.withIndex('by_server_user', (q) =>
				q.eq('serverId', args.serverId).eq('userId', user._id),
			)
			.first()

		let reviewId: Id<'serverReviews'>

		if (existing) {
			// Update existing review
			await ctx.db.patch(existing._id, {
				rating: args.rating,
				content: args.content?.trim() || undefined,
				updatedAt: now,
			})
			reviewId = existing._id
		} else {
			// Create new review
			reviewId = await ctx.db.insert('serverReviews', {
				serverId: args.serverId,
				userId: user._id,
				rating: args.rating,
				content: args.content?.trim() || undefined,
				isActive: true,
				createdAt: now,
			})
			await recordActivity(ctx, {
				userId: user._id,
				type: 'review_added',
				targetId: server._id,
				targetName: server.name,
				targetSlug: server.slug,
				metadata: { rating: args.rating, targetType: 'server' },
			})
		}

		// Update server's denormalized stats
		await updateServerReviewStats(ctx, args.serverId)

		return reviewId
	},
})

/**
 * Delete a review
 */
export const remove = mutation({
	args: { id: v.id('serverReviews') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to delete a review')
		}
		await enforceRateLimit(
			ctx,
			'reviewMutation',
			user._id,
			'Too many review changes. Please wait before trying again.',
		)

		const review = await ctx.db.get(args.id)
		if (!review) {
			throw new Error('Review not found')
		}

		// Only the reviewer can delete (add admin check later)
		if (review.userId !== user._id) {
			throw new Error('You can only delete your own reviews')
		}

		const serverId = review.serverId
		await ctx.db.delete(args.id)

		// Update server's denormalized stats
		await updateServerReviewStats(ctx, serverId)
	},
})

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Update serverStats with review stats
 */
async function updateServerReviewStats(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
) {
	const reviews = await ctx.db
		.query('serverReviews')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.filter((q) => q.eq(q.field('isActive'), true))
		.collect()

	const reviewCount = reviews.length
	const averageRating =
		reviewCount > 0
			? Math.round(
					(reviews.reduce((sum, r) => sum + r.rating, 0) /
						reviewCount) *
						10,
				) / 10
			: 0

	const now = Date.now()

	const stats = await ensureServerStats(ctx, serverId)
	await ctx.db.patch(stats._id, {
		averageRating,
		reviewCount,
		updatedAt: now,
	})
}
