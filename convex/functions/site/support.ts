import { v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'

const tierValidator = v.object({
	label: v.string(),
	amount: v.number(),
	description: v.optional(v.string()),
})

// =============================================================================
// MUTATIONS
// =============================================================================

export const upsert = mutation({
	args: {
		enabled: v.boolean(),
		externalUrl: v.optional(v.string()),
		tiers: v.array(tierValidator),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('You must be logged in')

		const existing = await ctx.db
			.query('supportTiers')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.first()

		const now = Date.now()

		if (existing) {
			await ctx.db.patch(existing._id, {
				enabled: args.enabled,
				externalUrl: args.externalUrl,
				tiers: args.tiers,
				updatedAt: now,
			})
			return existing._id
		}

		return await ctx.db.insert('supportTiers', {
			userId: user._id,
			enabled: args.enabled,
			externalUrl: args.externalUrl,
			tiers: args.tiers,
			updatedAt: now,
		})
	},
})

// =============================================================================
// QUERIES
// =============================================================================

export const getByUser = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const config = await ctx.db
			.query('supportTiers')
			.withIndex('by_user', (q) => q.eq('userId', args.userId))
			.first()

		if (!config || !config.enabled) return null

		return {
			externalUrl: config.externalUrl,
			tiers: config.tiers,
		}
	},
})

export const getMy = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) return null

		return await ctx.db
			.query('supportTiers')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.first()
	},
})
