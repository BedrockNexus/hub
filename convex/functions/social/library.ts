import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { canFollow } from '../../lib/follows'
import { authedMutation, authedQuery } from '../../lib/functions'
import { enforceRateLimit } from '../../lib/rateLimits'
import { summarizeTarget } from '../../lib/targetSummaries'
import { listingTargetType } from '../../schemas/social'

/**
 * The private library: add-ons, resource packs, plugins and servers a user
 * saved. Nobody else sees it and it is not counted anywhere; the public
 * signal is a follow (social/follows). The launcher syncs this list.
 */

const MAX_PAGE_SIZE = 50
const MAX_ID_LENGTH = 64

type ListingType = Doc<'favourites'>['targetType']
const TYPE_FROM_TARGET = {
	project: 'project',
	server: 'server',
	plugin: 'plugin',
} as const

const targetArgs = { targetType: listingTargetType, targetId: v.string() }

async function findEntry(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	targetType: ListingType,
	targetId: string,
): Promise<Doc<'favourites'> | null> {
	switch (targetType) {
		case 'project': {
			const projectId = ctx.db.normalizeId('projects', targetId)
			if (!projectId) return null
			return ctx.db
				.query('favourites')
				.withIndex('by_user_project', (q) =>
					q.eq('userId', userId).eq('projectId', projectId),
				)
				.first()
		}
		case 'server': {
			const serverId = ctx.db.normalizeId('servers', targetId)
			if (!serverId) return null
			return ctx.db
				.query('favourites')
				.withIndex('by_user_server', (q) =>
					q.eq('userId', userId).eq('serverId', serverId),
				)
				.first()
		}
		case 'plugin': {
			const pluginId = ctx.db.normalizeId('plugins', targetId)
			if (!pluginId) return null
			return ctx.db
				.query('favourites')
				.withIndex('by_user_plugin', (q) =>
					q.eq('userId', userId).eq('pluginId', pluginId),
				)
				.first()
		}
	}
}

function entryTargetId(entry: Doc<'favourites'>): string | undefined {
	return entry.projectId ?? entry.serverId ?? entry.pluginId
}

/** Whether the caller saved the item. Signed-out visitors get false. */
export const getState = query({
	args: targetArgs,
	returns: v.object({ saved: v.boolean() }),
	handler: async (ctx, args) => {
		if (args.targetId.length > MAX_ID_LENGTH) return { saved: false }
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) return { saved: false }
		const entry = await findEntry(ctx, user._id, args.targetType, args.targetId)
		return { saved: entry !== null }
	},
})

/** Saves or removes the item; returns whether it is now in the library. */
export const toggle = authedMutation({
	args: targetArgs,
	returns: v.boolean(),
	handler: async (ctx, args) => {
		if (args.targetId.length > MAX_ID_LENGTH) {
			throw new ConvexError('Unknown item')
		}
		await enforceRateLimit(
			ctx,
			'favouriteMutation',
			ctx.user._id,
			'Too many library changes. Please wait before trying again.',
		)
		const existing = await findEntry(
			ctx,
			ctx.user._id,
			args.targetType,
			args.targetId,
		)
		if (existing) {
			await ctx.db.delete(existing._id)
			return false
		}
		const target = { targetType: args.targetType, targetId: args.targetId }
		// The same "exists and is public" rule as following.
		if (!(await canFollow(ctx, target, ctx.user._id))) {
			throw new ConvexError('This is not publicly available')
		}
		const base = {
			userId: ctx.user._id,
			targetType: TYPE_FROM_TARGET[args.targetType],
			createdAt: Date.now(),
		}
		if (args.targetType === 'project') {
			const projectId = ctx.db.normalizeId('projects', args.targetId)
			if (projectId) await ctx.db.insert('favourites', { ...base, projectId })
		} else if (args.targetType === 'server') {
			const serverId = ctx.db.normalizeId('servers', args.targetId)
			if (serverId) await ctx.db.insert('favourites', { ...base, serverId })
		} else {
			const pluginId = ctx.db.normalizeId('plugins', args.targetId)
			if (pluginId) await ctx.db.insert('favourites', { ...base, pluginId })
		}
		return true
	},
})

/**
 * The caller's library, newest first. Items that are no longer public come
 * back as null so pages keep their size; the UI skips them.
 */
export const listMine = authedQuery({
	args: {
		paginationOpts: paginationOptsValidator,
		targetType: v.optional(listingTargetType),
	},
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('favourites')
			.withIndex('by_user', (q) => q.eq('userId', ctx.user._id))
			.order('desc')
			.paginate({
				...args.paginationOpts,
				numItems: Math.min(args.paginationOpts.numItems, MAX_PAGE_SIZE),
			})
		const page = await Promise.all(
			result.page
				.filter(
					(entry) => !args.targetType || entry.targetType === args.targetType,
				)
				.map(async (entry) => {
					const targetId = entryTargetId(entry)
					if (!targetId) return null
					const summary = await summarizeTarget(ctx, {
						targetType: entry.targetType,
						targetId,
					})
					return summary ? { ...summary, savedAt: entry.createdAt } : null
				}),
		)
		return { ...result, page }
	},
})
