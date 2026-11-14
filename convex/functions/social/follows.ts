import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { type MutationCtx, type QueryCtx, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import {
	adjustFollowerCount,
	canFollow,
	type FollowTarget,
	getFollow,
	getFollowerCount,
} from '../../lib/follows'
import {
	isPublicPlugin,
	isPublicProject,
	isPublicServer,
} from '../../lib/contentVisibility'
import { authedMutation, authedQuery } from '../../lib/functions'
import { enforceRateLimit } from '../../lib/rateLimits'
import { summarizeTarget } from '../../lib/targetSummaries'
import { followTargetType, listingTargetType } from '../../schemas/social'

/**
 * Following users, organizations, listings and collections (roadmap
 * Phase 2). Follows are public signals: they feed "Most followed" and
 * trending, and decide who hears about new releases (social/notifications).
 */

const MAX_ID_LENGTH = 64
const MAX_PAGE_SIZE = 50

const targetArgs = {
	targetType: followTargetType,
	targetId: v.string(),
}

function checkId(targetId: string) {
	if (!targetId || targetId.length > MAX_ID_LENGTH) {
		throw new ConvexError('Unknown follow target')
	}
}

/** Whether the caller follows the target, and its follower count. */
export const getState = query({
	args: targetArgs,
	returns: v.object({ isFollowing: v.boolean(), count: v.number() }),
	handler: async (ctx, args) => {
		if (args.targetId.length > MAX_ID_LENGTH) {
			return { isFollowing: false, count: 0 }
		}
		const user = await authComponent.safeGetAuthUser(ctx)
		const [existing, count] = await Promise.all([
			user ? getFollow(ctx, user._id, args) : null,
			getFollowerCount(ctx, args),
		])
		return { isFollowing: existing !== null, count }
	},
})

/** Follows or unfollows; returns whether the caller now follows it. */
export const toggle = authedMutation({
	args: targetArgs,
	returns: v.boolean(),
	handler: async (ctx, args) => {
		checkId(args.targetId)
		return toggleFollow(ctx, ctx.user._id, {
			targetType: args.targetType,
			targetId: args.targetId,
		})
	},
})

async function toggleFollow(
	ctx: MutationCtx,
	userId: string,
	target: FollowTarget,
): Promise<boolean> {
	await enforceRateLimit(
		ctx,
		'followMutation',
		userId,
		'Too many follow changes. Please wait before trying again.',
	)
	const existing = await getFollow(ctx, userId, target)
	if (existing) {
		await ctx.db.delete(existing._id)
		await adjustFollowerCount(ctx, target, -1)
		return false
	}
	if (!(await canFollow(ctx, target, userId))) {
		throw new ConvexError('This cannot be followed')
	}
	await ctx.db.insert('follows', {
		userId,
		...target,
		createdAt: Date.now(),
	})
	await adjustFollowerCount(ctx, target, 1)
	return true
}

// =============================================================================
// THE OWNER OF A LISTING
// Listing pages do not reveal owner IDs, so the owner card follows "whoever
// owns this listing", resolved here.
// =============================================================================

const ownerOfArgs = { listingType: listingTargetType, listingId: v.string() }

async function ownerOf(
	ctx: QueryCtx,
	listingType: 'project' | 'server' | 'plugin',
	listingId: string,
): Promise<FollowTarget | null> {
	if (listingId.length > MAX_ID_LENGTH) return null
	let owner: { ownerType: 'user' | 'organization'; ownerId: string } | null =
		null
	if (listingType === 'project') {
		const id = ctx.db.normalizeId('projects', listingId)
		const doc = id ? await ctx.db.get(id) : null
		owner = doc && isPublicProject(doc) ? doc : null
	} else if (listingType === 'server') {
		const id = ctx.db.normalizeId('servers', listingId)
		const doc = id ? await ctx.db.get(id) : null
		owner = doc && isPublicServer(doc) ? doc : null
	} else {
		const id = ctx.db.normalizeId('plugins', listingId)
		const doc = id ? await ctx.db.get(id) : null
		owner = doc && isPublicPlugin(doc) ? doc : null
	}
	return owner ? { targetType: owner.ownerType, targetId: owner.ownerId } : null
}

export const getOwnerState = query({
	args: ownerOfArgs,
	returns: v.object({
		isFollowing: v.boolean(),
		count: v.number(),
		isSelf: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const owner = await ownerOf(ctx, args.listingType, args.listingId)
		if (!owner) return { isFollowing: false, count: 0, isSelf: false }
		const user = await authComponent.safeGetAuthUser(ctx)
		const [existing, count] = await Promise.all([
			user ? getFollow(ctx, user._id, owner) : null,
			getFollowerCount(ctx, owner),
		])
		return {
			isFollowing: existing !== null,
			count,
			isSelf: owner.targetType === 'user' && owner.targetId === user?._id,
		}
	},
})

export const toggleOwner = authedMutation({
	args: ownerOfArgs,
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const owner = await ownerOf(ctx, args.listingType, args.listingId)
		if (!owner) throw new ConvexError('This cannot be followed')
		return toggleFollow(ctx, ctx.user._id, owner)
	},
})

/**
 * What the caller follows, newest first. Items that are gone or no longer
 * public come back as null so the page keeps its position; the UI skips them.
 */
export const listMine = authedQuery({
	args: {
		paginationOpts: paginationOptsValidator,
		targetType: v.optional(followTargetType),
	},
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('follows')
			.withIndex('by_userId_and_createdAt', (q) =>
				q.eq('userId', ctx.user._id),
			)
			.order('desc')
			.paginate({
				...args.paginationOpts,
				numItems: Math.min(args.paginationOpts.numItems, MAX_PAGE_SIZE),
			})
		const page = await Promise.all(
			result.page
				.filter(
					(row) => !args.targetType || row.targetType === args.targetType,
				)
				.map(async (row) => {
					const summary = await summarizeTarget(ctx, row)
					return summary ? { ...summary, followedAt: row.createdAt } : null
				}),
		)
		return { ...result, page }
	},
})
