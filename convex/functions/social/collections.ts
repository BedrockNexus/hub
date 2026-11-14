import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import { type MutationCtx, type QueryCtx, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { recordActivity } from '../../lib/activity'
import { canFollow } from '../../lib/follows'
import { authedMutation, authedQuery } from '../../lib/functions'
import { enforceRateLimit } from '../../lib/rateLimits'
import { summarizeTarget } from '../../lib/targetSummaries'
import { listingTargetType } from '../../schemas/social'

/**
 * Named lists of add-ons, resource packs, plugins and servers (roadmap
 * Phase 2). Public collections appear on their owner's profile and in the
 * collection directory; unlisted ones open only by link; private ones only
 * for their owner. Anyone else can follow a public or unlisted collection.
 */

const MAX_COLLECTIONS_PER_USER = 50
const MAX_ITEMS_PER_COLLECTION = 200
const MAX_NAME_LENGTH = 60
const MAX_DESCRIPTION_LENGTH = 500
const MAX_NOTE_LENGTH = 280
const MAX_PAGE_SIZE = 48
const MAX_ID_LENGTH = 64

const visibilityValidator = v.union(
	v.literal('public'),
	v.literal('unlisted'),
	v.literal('private'),
)

type Ctx = QueryCtx | MutationCtx

function cleanName(name: string) {
	const value = name.trim().replace(/\s+/g, ' ')
	if (!value) throw new ConvexError('Give the collection a name')
	if (value.length > MAX_NAME_LENGTH) {
		throw new ConvexError(`Names can be at most ${MAX_NAME_LENGTH} characters`)
	}
	return value
}

function cleanText(text: string | undefined, max: number, label: string) {
	const value = text?.trim()
	if (!value) return undefined
	if (value.length > max) {
		throw new ConvexError(`${label} can be at most ${max} characters`)
	}
	return value
}

async function allocatePublicId(ctx: MutationCtx) {
	for (let attempt = 0; attempt < 20; attempt++) {
		const code = Array.from({ length: 8 }, () =>
			Math.floor(Math.random() * 36).toString(36),
		).join('')
		const candidate = `c_${code}`
		const existing = await ctx.db
			.query('collections')
			.withIndex('by_publicId', (q) => q.eq('publicId', candidate))
			.unique()
		if (!existing) return candidate
	}
	throw new ConvexError('Could not create the collection. Please try again.')
}

async function requireOwnCollection(
	ctx: MutationCtx,
	collectionId: Id<'collections'>,
	userId: string,
) {
	const collection = await ctx.db.get(collectionId)
	if (!collection || collection.ownerId !== userId) {
		throw new ConvexError('Collection not found')
	}
	return collection
}

async function findItem(
	ctx: Ctx,
	collectionId: Id<'collections'>,
	targetType: Doc<'collectionItems'>['targetType'],
	targetId: string,
) {
	return ctx.db
		.query('collectionItems')
		.withIndex('by_collectionId_and_targetType_and_targetId', (q) =>
			q
				.eq('collectionId', collectionId)
				.eq('targetType', targetType)
				.eq('targetId', targetId),
		)
		.unique()
}

async function ownerCard(ctx: Ctx, ownerId: string) {
	const user = (await authComponent.getAnyUserById(ctx, ownerId)) as {
		username?: string | null
		displayUsername?: string | null
		image?: string | null
		banned?: boolean | null
	} | null
	if (!user?.username || user.banned) return null
	return {
		username: user.username,
		name: user.displayUsername || user.username,
		imageUrl:
			user.image && /^https?:\/\//.test(user.image) ? user.image : undefined,
	}
}

function toCard(collection: Doc<'collections'>) {
	return {
		_id: collection._id,
		publicId: collection.publicId,
		name: collection.name,
		description: collection.description,
		visibility: collection.visibility,
		itemCount: collection.itemCount,
		followerCount: collection.followerCount,
		updatedAt: collection.updatedAt,
	}
}

// =============================================================================
// OWNER
// =============================================================================

export const create = authedMutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		visibility: visibilityValidator,
	},
	returns: v.object({ _id: v.id('collections'), publicId: v.string() }),
	handler: async (ctx, args) => {
		await enforceRateLimit(
			ctx,
			'collectionCreate',
			ctx.user._id,
			'You have created many collections today. Please try again later.',
		)
		const existing = await ctx.db
			.query('collections')
			.withIndex('by_ownerId_and_updatedAt', (q) =>
				q.eq('ownerId', ctx.user._id),
			)
			.take(MAX_COLLECTIONS_PER_USER)
		if (existing.length >= MAX_COLLECTIONS_PER_USER) {
			throw new ConvexError(
				`You can have at most ${MAX_COLLECTIONS_PER_USER} collections`,
			)
		}
		const now = Date.now()
		const publicId = await allocatePublicId(ctx)
		const name = cleanName(args.name)
		const _id = await ctx.db.insert('collections', {
			ownerId: ctx.user._id,
			publicId,
			name,
			description: cleanText(
				args.description,
				MAX_DESCRIPTION_LENGTH,
				'Descriptions',
			),
			visibility: args.visibility,
			itemCount: 0,
			followerCount: 0,
			createdAt: now,
			updatedAt: now,
		})
		if (args.visibility === 'public') {
			await recordActivity(ctx, {
				userId: ctx.user._id,
				type: 'collection_created',
				targetId: _id,
				targetName: name,
				targetSlug: publicId,
			})
		}
		return { _id, publicId }
	},
})

export const update = authedMutation({
	args: {
		collectionId: v.id('collections'),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		visibility: v.optional(visibilityValidator),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(
			ctx,
			'collectionMutation',
			ctx.user._id,
			'Too many collection changes. Please wait before trying again.',
		)
		const collection = await requireOwnCollection(
			ctx,
			args.collectionId,
			ctx.user._id,
		)
		const name = args.name === undefined ? collection.name : cleanName(args.name)
		await ctx.db.patch(collection._id, {
			name,
			description:
				args.description === undefined
					? collection.description
					: cleanText(args.description, MAX_DESCRIPTION_LENGTH, 'Descriptions'),
			visibility: args.visibility ?? collection.visibility,
			updatedAt: Date.now(),
		})
		if (args.visibility === 'public' && collection.visibility !== 'public') {
			await recordActivity(ctx, {
				userId: ctx.user._id,
				type: 'collection_created',
				targetId: collection._id,
				targetName: name,
				targetSlug: collection.publicId,
			})
		}
		return null
	},
})

export const remove = authedMutation({
	args: { collectionId: v.id('collections') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const collection = await requireOwnCollection(
			ctx,
			args.collectionId,
			ctx.user._id,
		)
		const items = await ctx.db
			.query('collectionItems')
			.withIndex('by_collectionId_and_addedAt', (q) =>
				q.eq('collectionId', collection._id),
			)
			.take(MAX_ITEMS_PER_COLLECTION + 1)
		for (const item of items) await ctx.db.delete(item._id)
		await ctx.db.delete(collection._id)
		await ctx.scheduler.runAfter(
			0,
			internal.functions.social.cleanup.removeTargetFollows,
			{ targetType: 'collection', targetId: collection._id },
		)
		return null
	},
})

export const addItem = authedMutation({
	args: {
		collectionId: v.id('collections'),
		targetType: listingTargetType,
		targetId: v.string(),
		note: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		if (args.targetId.length > MAX_ID_LENGTH) {
			throw new ConvexError('Unknown item')
		}
		await enforceRateLimit(
			ctx,
			'collectionMutation',
			ctx.user._id,
			'Too many collection changes. Please wait before trying again.',
		)
		const collection = await requireOwnCollection(
			ctx,
			args.collectionId,
			ctx.user._id,
		)
		const note = cleanText(args.note, MAX_NOTE_LENGTH, 'Notes')
		const existing = await findItem(
			ctx,
			collection._id,
			args.targetType,
			args.targetId,
		)
		if (existing) {
			await ctx.db.patch(existing._id, { note })
			return null
		}
		if (collection.itemCount >= MAX_ITEMS_PER_COLLECTION) {
			throw new ConvexError(
				`A collection can hold at most ${MAX_ITEMS_PER_COLLECTION} items`,
			)
		}
		const target = { targetType: args.targetType, targetId: args.targetId }
		if (!(await canFollow(ctx, target, ctx.user._id))) {
			throw new ConvexError('This is not publicly available')
		}
		const now = Date.now()
		await ctx.db.insert('collectionItems', {
			collectionId: collection._id,
			...target,
			note,
			addedAt: now,
		})
		await ctx.db.patch(collection._id, {
			itemCount: collection.itemCount + 1,
			updatedAt: now,
		})
		return null
	},
})

export const removeItem = authedMutation({
	args: {
		collectionId: v.id('collections'),
		targetType: listingTargetType,
		targetId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const collection = await requireOwnCollection(
			ctx,
			args.collectionId,
			ctx.user._id,
		)
		const item = await findItem(
			ctx,
			collection._id,
			args.targetType,
			args.targetId,
		)
		if (!item) return null
		await ctx.db.delete(item._id)
		await ctx.db.patch(collection._id, {
			itemCount: Math.max(0, collection.itemCount - 1),
			updatedAt: Date.now(),
		})
		return null
	},
})

/** The caller's collections, most recently changed first. */
export const listMine = authedQuery({
	args: {},
	handler: async (ctx) => {
		const collections = await ctx.db
			.query('collections')
			.withIndex('by_ownerId_and_updatedAt', (q) =>
				q.eq('ownerId', ctx.user._id),
			)
			.order('desc')
			.take(MAX_COLLECTIONS_PER_USER)
		return collections.map(toCard)
	},
})

/** For the "Add to collection" menu: each of the caller's collections and whether it holds the item. */
export const membership = query({
	args: { targetType: listingTargetType, targetId: v.string() },
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user || args.targetId.length > MAX_ID_LENGTH) return []
		const collections = await ctx.db
			.query('collections')
			.withIndex('by_ownerId_and_updatedAt', (q) => q.eq('ownerId', user._id))
			.order('desc')
			.take(MAX_COLLECTIONS_PER_USER)
		return Promise.all(
			collections.map(async (collection) => ({
				_id: collection._id,
				name: collection.name,
				visibility: collection.visibility,
				contains:
					(await findItem(ctx, collection._id, args.targetType, args.targetId)) !==
					null,
			})),
		)
	},
})

// =============================================================================
// PUBLIC
// =============================================================================

/** A collection by its `c_` reference. Private ones only for their owner. */
export const getByRef = query({
	args: { ref: v.string() },
	handler: async (ctx, args) => {
		if (args.ref.length > MAX_ID_LENGTH) return null
		const collection = await ctx.db
			.query('collections')
			.withIndex('by_publicId', (q) => q.eq('publicId', args.ref))
			.unique()
		if (!collection) return null
		const viewer = await authComponent.safeGetAuthUser(ctx)
		const isOwner = viewer?._id === collection.ownerId
		if (collection.visibility === 'private' && !isOwner) return null
		const owner = await ownerCard(ctx, collection.ownerId)
		if (!owner && !isOwner) return null
		return { ...toCard(collection), owner, isOwner }
	},
})

/** A collection's items, newest first; gone or private items are null. */
export const listItems = query({
	args: {
		collectionId: v.id('collections'),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		const collection = await ctx.db.get(args.collectionId)
		const viewer = await authComponent.safeGetAuthUser(ctx)
		if (
			!collection ||
			(collection.visibility === 'private' && viewer?._id !== collection.ownerId)
		) {
			return { page: [], isDone: true, continueCursor: '' }
		}
		const result = await ctx.db
			.query('collectionItems')
			.withIndex('by_collectionId_and_addedAt', (q) =>
				q.eq('collectionId', collection._id),
			)
			.order('desc')
			.paginate({
				...args.paginationOpts,
				numItems: Math.min(args.paginationOpts.numItems, MAX_PAGE_SIZE),
			})
		const page = await Promise.all(
			result.page.map(async (item) => {
				const summary = await summarizeTarget(ctx, item)
				return summary
					? { ...summary, note: item.note, addedAt: item.addedAt }
					: null
			}),
		)
		return { ...result, page }
	},
})

/** Public collections on a creator's profile. */
export const listByUsername = query({
	args: { username: v.string() },
	handler: async (ctx, args) => {
		const username = args.username.trim()
		if (!username || username.length > MAX_ID_LENGTH) return []
		const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: 'user',
			where: [{ field: 'username', value: username }],
		})) as { _id: string; banned?: boolean | null } | null
		if (!user || user.banned) return []
		const collections = await ctx.db
			.query('collections')
			.withIndex('by_ownerId_and_updatedAt', (q) => q.eq('ownerId', user._id))
			.order('desc')
			.take(MAX_COLLECTIONS_PER_USER)
		return collections
			.filter((collection) => collection.visibility === 'public')
			.map(toCard)
	},
})

/** The collection directory: public collections, most followed first. */
export const listPopular = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('collections')
			.withIndex('by_visibility_and_followerCount', (q) =>
				q.eq('visibility', 'public'),
			)
			.order('desc')
			.paginate({
				...args.paginationOpts,
				numItems: Math.min(args.paginationOpts.numItems, MAX_PAGE_SIZE),
			})
		const page = await Promise.all(
			result.page.map(async (collection) => {
				if (collection.itemCount === 0) return null
				const owner = await ownerCard(ctx, collection.ownerId)
				return owner ? { ...toCard(collection), owner } : null
			}),
		)
		return { ...result, page }
	},
})
