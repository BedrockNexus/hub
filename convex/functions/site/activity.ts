import { v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'

const activityTypeValidator = v.union(
	v.literal('server_added'),
	v.literal('server_updated'),
	v.literal('review_added'),
	v.literal('collection_created'),
)

// =============================================================================
// MUTATIONS
// =============================================================================

export const log = mutation({
	args: {
		type: activityTypeValidator,
		targetId: v.optional(v.string()),
		targetName: v.optional(v.string()),
		targetSlug: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('You must be logged in')

		return await ctx.db.insert('activityLog', {
			userId: user._id,
			type: args.type,
			targetId: args.targetId,
			targetName: args.targetName,
			targetSlug: args.targetSlug,
			metadata: args.metadata,
			createdAt: Date.now(),
		})
	},
})

// =============================================================================
// QUERIES
// =============================================================================

export const getByUser = query({
	args: {
		userId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 20

		const activities = await ctx.db
			.query('activityLog')
			.withIndex('by_user', (q) => q.eq('userId', args.userId))
			.order('desc')
			.take(limit)

		return activities
	},
})
