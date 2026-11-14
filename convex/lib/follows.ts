import type { Infer } from 'convex/values'
import { components } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { authComponent } from '../auth'
import type { followTargetType } from '../schemas/social'
import {
	isPublicPlugin,
	isPublicProject,
	isPublicServer,
} from './contentVisibility'
import { utcDayKey } from './dayKeys'
import { ensureProjectStats, ensureServerStats } from './discovery'

/**
 * Who follows what (roadmap Phase 2). A follow is public: it counts toward
 * "Most followed" and trending, unlike a private library save.
 *
 * `followerCounts` holds every target's count. Listings sort on copies of it:
 *
 * - projects  -> projectStats.followerCount, plus today's net follows in
 *                projectDailyStats.follows (trending)
 * - servers   -> serverStats.followerCount
 * - plugins   -> plugins.followerCount
 * - users and organizations -> creatorListings.followerCount, when the
 *                owner has a listing (lib/creatorListings.ts copies the count
 *                in when one is created)
 * - collections -> collections.followerCount
 */

export type FollowTargetType = Infer<typeof followTargetType>

export interface FollowTarget {
	targetType: FollowTargetType
	targetId: string
}

type Ctx = QueryCtx | MutationCtx

/**
 * True when the caller may start following the target: it exists and is
 * public. Unfollowing never checks this, so a follow can always be undone.
 */
export async function canFollow(
	ctx: Ctx,
	target: FollowTarget,
	userId: string,
): Promise<boolean> {
	switch (target.targetType) {
		case 'project': {
			const id = ctx.db.normalizeId('projects', target.targetId)
			const project = id ? await ctx.db.get(id) : null
			return !!project && isPublicProject(project)
		}
		case 'server': {
			const id = ctx.db.normalizeId('servers', target.targetId)
			const server = id ? await ctx.db.get(id) : null
			return !!server && isPublicServer(server)
		}
		case 'plugin': {
			const id = ctx.db.normalizeId('plugins', target.targetId)
			const plugin = id ? await ctx.db.get(id) : null
			return !!plugin && isPublicPlugin(plugin)
		}
		case 'collection': {
			const id = ctx.db.normalizeId('collections', target.targetId)
			const collection = id ? await ctx.db.get(id) : null
			return (
				!!collection &&
				collection.visibility !== 'private' &&
				collection.ownerId !== userId
			)
		}
		case 'user': {
			if (target.targetId === userId) return false
			const user = (await authComponent.getAnyUserById(
				ctx,
				target.targetId,
			)) as { username?: string | null; banned?: boolean | null } | null
			return !!user?.username && !user.banned
		}
		case 'organization': {
			const org = await ctx.runQuery(components.betterAuth.adapter.findOne, {
				model: 'organization',
				where: [{ field: '_id', value: target.targetId }],
			})
			return org !== null
		}
	}
}

export async function getFollow(
	ctx: Ctx,
	userId: string,
	target: FollowTarget,
): Promise<Doc<'follows'> | null> {
	return await ctx.db
		.query('follows')
		.withIndex('by_userId_and_targetType_and_targetId', (q) =>
			q
				.eq('userId', userId)
				.eq('targetType', target.targetType)
				.eq('targetId', target.targetId),
		)
		.unique()
}

export async function getFollowerCount(
	ctx: Ctx,
	target: FollowTarget,
): Promise<number> {
	const row = await ctx.db
		.query('followerCounts')
		.withIndex('by_targetType_and_targetId', (q) =>
			q.eq('targetType', target.targetType).eq('targetId', target.targetId),
		)
		.unique()
	return row?.count ?? 0
}

/** Call after the follow row was inserted (+1) or deleted (-1). */
export async function adjustFollowerCount(
	ctx: MutationCtx,
	target: FollowTarget,
	delta: 1 | -1,
): Promise<number> {
	const row = await ctx.db
		.query('followerCounts')
		.withIndex('by_targetType_and_targetId', (q) =>
			q.eq('targetType', target.targetType).eq('targetId', target.targetId),
		)
		.unique()
	const count = Math.max(0, (row?.count ?? 0) + delta)
	if (row) {
		await ctx.db.patch(row._id, { count })
	} else {
		await ctx.db.insert('followerCounts', { ...target, count })
	}
	await copyFollowerCount(ctx, target, count, delta)
	return count
}

async function copyFollowerCount(
	ctx: MutationCtx,
	target: FollowTarget,
	count: number,
	delta: 1 | -1,
) {
	switch (target.targetType) {
		case 'project': {
			const projectId = ctx.db.normalizeId('projects', target.targetId)
			if (!projectId) return
			if (!(await ctx.db.get(projectId))) return
			const stats = await ensureProjectStats(ctx, projectId)
			await ctx.db.patch(stats._id, { followerCount: count })
			await adjustProjectFollowsToday(ctx, projectId, delta)
			return
		}
		case 'server': {
			const serverId = ctx.db.normalizeId('servers', target.targetId)
			if (!serverId) return
			if (!(await ctx.db.get(serverId))) return
			const stats = await ensureServerStats(ctx, serverId)
			await ctx.db.patch(stats._id, { followerCount: count })
			return
		}
		case 'plugin': {
			const pluginId = ctx.db.normalizeId('plugins', target.targetId)
			if (pluginId && (await ctx.db.get(pluginId)))
				await ctx.db.patch(pluginId, { followerCount: count })
			return
		}
		case 'collection': {
			const collectionId = ctx.db.normalizeId('collections', target.targetId)
			if (collectionId && (await ctx.db.get(collectionId)))
				await ctx.db.patch(collectionId, { followerCount: count })
			return
		}
		case 'user':
		case 'organization': {
			const listing = await ctx.db
				.query('creatorListings')
				.withIndex('by_ownerType_and_ownerId', (q) =>
					q.eq('ownerType', target.targetType as 'user' | 'organization')
						.eq('ownerId', target.targetId),
				)
				.unique()
			if (listing) await ctx.db.patch(listing._id, { followerCount: count })
			return
		}
	}
}

async function adjustProjectFollowsToday(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
	delta: 1 | -1,
) {
	const dayKey = utcDayKey(Date.now())
	const day = await ctx.db
		.query('projectDailyStats')
		.withIndex('by_projectId_and_dayKey', (q) =>
			q.eq('projectId', projectId).eq('dayKey', dayKey),
		)
		.unique()
	if (day) {
		await ctx.db.patch(day._id, { follows: (day.follows ?? 0) + delta })
		return
	}
	await ctx.db.insert('projectDailyStats', {
		projectId,
		dayKey,
		downloads: 0,
		favourites: 0,
		apiDownloads: 0,
		views: 0,
		follows: delta,
	})
}

/**
 * Removes every follow of a target that no longer exists, keeping counts
 * consistent. Bounded per call; returns true when more remain.
 */
export async function removeFollowsOf(
	ctx: MutationCtx,
	target: FollowTarget,
	limit = 200,
): Promise<boolean> {
	const rows = await ctx.db
		.query('follows')
		.withIndex('by_targetType_and_targetId', (q) =>
			q.eq('targetType', target.targetType).eq('targetId', target.targetId),
		)
		.take(limit + 1)
	for (const row of rows.slice(0, limit)) {
		await ctx.db.delete(row._id)
	}
	const counter = await ctx.db
		.query('followerCounts')
		.withIndex('by_targetType_and_targetId', (q) =>
			q.eq('targetType', target.targetType).eq('targetId', target.targetId),
		)
		.unique()
	if (counter) {
		const remaining = Math.max(0, counter.count - Math.min(rows.length, limit))
		if (rows.length > limit) await ctx.db.patch(counter._id, { count: remaining })
		else await ctx.db.delete(counter._id)
	}
	return rows.length > limit
}
