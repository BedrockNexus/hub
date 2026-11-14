import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation, type MutationCtx } from '../../_generated/server'
import { adjustFollowerCount, removeFollowsOf } from '../../lib/follows'
import { followTargetType } from '../../schemas/social'

/**
 * Removes a deleted account's follows, library, collections, notifications
 * and preferences, and everyone's follows of the account. Scheduled from the
 * Better Auth user delete trigger (auth.ts). Runs in bounded batches and
 * reschedules itself until nothing is left.
 */

const BATCH = 100

export const removeUserData = internalMutation({
	args: { userId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { userId } = args

		const follows = await ctx.db
			.query('follows')
			.withIndex('by_userId_and_createdAt', (q) => q.eq('userId', userId))
			.take(BATCH)
		for (const follow of follows) {
			await ctx.db.delete(follow._id)
			await adjustFollowerCount(ctx, follow, -1)
		}
		if (follows.length === BATCH) return reschedule(ctx, userId)

		const saved = await ctx.db
			.query('favourites')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.take(BATCH)
		for (const entry of saved) await ctx.db.delete(entry._id)
		if (saved.length === BATCH) return reschedule(ctx, userId)

		const collection = await ctx.db
			.query('collections')
			.withIndex('by_ownerId_and_updatedAt', (q) => q.eq('ownerId', userId))
			.first()
		if (collection) {
			const items = await ctx.db
				.query('collectionItems')
				.withIndex('by_collectionId_and_addedAt', (q) =>
					q.eq('collectionId', collection._id),
				)
				.take(BATCH)
			for (const item of items) await ctx.db.delete(item._id)
			const more = await removeFollowsOf(ctx, {
				targetType: 'collection',
				targetId: collection._id,
			})
			if (items.length < BATCH && !more) await ctx.db.delete(collection._id)
			return reschedule(ctx, userId)
		}

		const notifications = await ctx.db
			.query('notifications')
			.withIndex('by_userId_and_createdAt', (q) => q.eq('userId', userId))
			.take(BATCH)
		for (const row of notifications) await ctx.db.delete(row._id)
		if (notifications.length === BATCH) return reschedule(ctx, userId)

		const preferences = await ctx.db
			.query('notificationPreferences')
			.withIndex('by_userId', (q) => q.eq('userId', userId))
			.unique()
		if (preferences) await ctx.db.delete(preferences._id)

		if (await removeFollowsOf(ctx, { targetType: 'user', targetId: userId }))
			return reschedule(ctx, userId)
		return null
	},
})

async function reschedule(ctx: MutationCtx, userId: string) {
	await ctx.scheduler.runAfter(
		0,
		internal.functions.social.cleanup.removeUserData,
		{ userId },
	)
	return null
}

/** Everyone's follows of a deleted organization, or of another target. */
export const removeTargetFollows = internalMutation({
	args: { targetType: followTargetType, targetId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		if (await removeFollowsOf(ctx, args)) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.social.cleanup.removeTargetFollows,
				args,
			)
		}
		return null
	},
})
