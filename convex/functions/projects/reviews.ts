import { v } from 'convex/values'
import type { MutationCtx } from '../../_generated/server'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import type { Doc, Id } from '../../_generated/dataModel'
import { isPublicProject } from '../../lib/contentVisibility'
import { enforceRateLimit } from '../../lib/rateLimits'

async function isReviewableProject(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
) {
	const project = await ctx.db.get(projectId)
	return project ? isPublicProject(project) : false
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get reviews for a project
 */
export const list = query({
	args: {
		projectId: v.id('projects'),
		limit: v.optional(v.number()),
		sortBy: v.optional(v.union(v.literal('recent'), v.literal('rating'))),
	},
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (!project || !isPublicProject(project)) return []
		const limit = args.limit ?? 20
		const sortBy = args.sortBy ?? 'recent'

		let reviews: Doc<'projectReviews'>[]

		if (sortBy === 'rating') {
			reviews = await ctx.db
				.query('projectReviews')
				.withIndex('by_project_rating', (q) =>
					q.eq('projectId', args.projectId),
				)
				.filter((q) => q.eq(q.field('isActive'), true))
				.order('desc')
				.take(limit)
		} else {
			reviews = await ctx.db
				.query('projectReviews')
				.withIndex('by_project', (q) =>
					q.eq('projectId', args.projectId),
				)
				.filter((q) => q.eq(q.field('isActive'), true))
				.order('desc')
				.take(limit)
		}

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
 * Get a user's review for a project
 */
export const getUserReview = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (!project || !isPublicProject(project)) return null
		const user = await authComponent.getAuthUser(ctx)
		if (!user) return null

		return await ctx.db
			.query('projectReviews')
			.withIndex('by_project_user', (q) =>
				q.eq('projectId', args.projectId).eq('userId', user._id),
			)
			.first()
	},
})

/**
 * Get review stats for a project
 */
export const getStats = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (!project || !isPublicProject(project)) {
			return {
				totalReviews: 0,
				averageRating: 0,
				distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
			}
		}
		const reviews = await ctx.db
			.query('projectReviews')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
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
			averageRating:
				Math.round((totalRating / reviews.length) * 10) / 10,
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
		projectId: v.id('projects'),
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

		if (args.rating < 1 || args.rating > 5) {
			throw new Error('Rating must be between 1 and 5')
		}
		if (!(await isReviewableProject(ctx, args.projectId))) {
			throw new Error('This project is not available for reviews')
		}

		const now = Date.now()

		const existing = await ctx.db
			.query('projectReviews')
			.withIndex('by_project_user', (q) =>
				q.eq('projectId', args.projectId).eq('userId', user._id),
			)
			.first()

		let reviewId: Id<'projectReviews'>

		if (existing) {
			await ctx.db.patch(existing._id, {
				rating: args.rating,
				content: args.content,
				isEdited: true,
				updatedAt: now,
			})
			reviewId = existing._id
		} else {
			reviewId = await ctx.db.insert('projectReviews', {
				projectId: args.projectId,
				userId: user._id,
				rating: args.rating,
				content: args.content,
				isActive: true,
				createdAt: now,
			})
		}

		await updateProjectReviewStats(ctx, args.projectId)

		return reviewId
	},
})

/**
 * Delete a review
 */
export const remove = mutation({
	args: { id: v.id('projectReviews') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to delete reviews')
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

		if (review.userId !== user._id) {
			throw new Error('You can only delete your own reviews')
		}

		await ctx.db.patch(args.id, { isActive: false })

		await updateProjectReviewStats(ctx, review.projectId)
	},
})

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function updateProjectReviewStats(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
) {
	const reviews = await ctx.db
		.query('projectReviews')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.filter((q) => q.eq(q.field('isActive'), true))
		.collect()

	const totalReviews = reviews.length
	const averageRating =
		totalReviews > 0
			? Math.round(
					(reviews.reduce((sum, r) => sum + r.rating, 0) /
						totalReviews) *
						10,
				) / 10
			: 0

	const now = Date.now()

	const stats = await ctx.db
		.query('projectStats')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.first()

	if (stats) {
		await ctx.db.patch(stats._id, {
			averageRating,
			reviewCount: totalReviews,
			updatedAt: now,
		})
	}
}
