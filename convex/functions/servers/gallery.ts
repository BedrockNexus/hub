import { v } from 'convex/values'
import { components } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import {
	assertValidGalleryImageMetadata,
	MAX_GALLERY_IMAGES,
	normalizeGalleryCaption,
} from '../../lib/gallery'
import { r2 } from '../../lib/r2'
import { buildEntityImageR2ObjectKey } from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'

const GALLERY_IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

type ServerOwner = {
	ownerType: 'user' | 'organization'
	ownerId: string
	registeredBy: string
}

async function canModifyServer(
	ctx: MutationCtx | QueryCtx,
	server: ServerOwner,
	userId: string,
	role?: string | null,
) {
	if (role === 'admin') {
		return true
	}

	if (server.ownerType === 'user') {
		return server.ownerId === userId || server.registeredBy === userId
	}

	const member = (await ctx.runQuery(
		components.betterAuth.adapter.findOne,
		{
			model: 'member',
			where: [
				{ field: 'organizationId', value: server.ownerId },
				{ field: 'userId', value: userId },
			],
		},
	)) as { id?: string } | null

	return !!member
}

async function assertCanManageServer(
	ctx: MutationCtx | QueryCtx,
	serverId: Id<'servers'>,
) {
	const user = await authComponent.getAuthUser(ctx)
	if (!user) {
		throw new Error('You must be logged in to manage gallery images')
	}

	const server = await ctx.db.get(serverId)
	if (!server) {
		throw new Error('Server not found')
	}
	if (!(await canModifyServer(ctx, server, user._id, user.role))) {
		throw new Error('You do not have permission to manage this gallery')
	}

	return { server, user }
}

async function getServerGallery(ctx: MutationCtx | QueryCtx, serverId: Id<'servers'>) {
	return ctx.db
		.query('serverGallery')
		.withIndex('by_server_sort', (q) => q.eq('serverId', serverId))
		.collect()
}

async function assertServerGalleryHasCapacity(
	ctx: MutationCtx | QueryCtx,
	serverId: Id<'servers'>,
) {
	const items = await getServerGallery(ctx, serverId)
	if (items.length >= MAX_GALLERY_IMAGES) {
		throw new Error(
			`Server galleries can contain up to ${MAX_GALLERY_IMAGES} images`,
		)
	}
	return items
}

async function enrichGalleryItem(item: Doc<'serverGallery'>) {
	return {
		...item,
		url: await r2.getUrl(item.r2Key, {
			expiresIn: GALLERY_IMAGE_URL_EXPIRES_IN,
		}),
	}
}

export const listPublic = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const server = await ctx.db.get(args.serverId)
		if (!server || server.status !== 'published') {
			return []
		}

		const items = await ctx.db
			.query('serverGallery')
			.withIndex('by_server_sort', (q) => q.eq('serverId', args.serverId))
			.collect()

		return Promise.all(items.map(enrichGalleryItem))
	},
})

export const listMine = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		await assertCanManageServer(ctx, args.serverId)

		const items = await ctx.db
			.query('serverGallery')
			.withIndex('by_server_sort', (q) => q.eq('serverId', args.serverId))
			.collect()

		return Promise.all(items.map(enrichGalleryItem))
	},
})

export const generateUploadUrl = mutation({
	args: {
		serverId: v.id('servers'),
		fileName: v.string(),
	},
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const { user } = await assertCanManageServer(ctx, args.serverId)
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		await assertServerGalleryHasCapacity(ctx, args.serverId)
		const key = buildEntityImageR2ObjectKey({
			userId: user._id,
			resourceType: 'servers',
			entityId: args.serverId,
			imageKind: 'gallery',
			fileName: args.fileName,
		})

		return r2.generateUploadUrl(key)
	},
})

export const add = mutation({
	args: {
		serverId: v.id('servers'),
		r2Key: v.string(),
		fileName: v.string(),
		fileSize: v.number(),
		mimeType: v.string(),
		caption: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { user } = await assertCanManageServer(ctx, args.serverId)
		assertValidGalleryImageMetadata(args)
		const existing = await assertServerGalleryHasCapacity(ctx, args.serverId)
		const now = Date.now()

		return await ctx.db.insert('serverGallery', {
			serverId: args.serverId,
			ownerId: user._id,
			r2Key: args.r2Key,
			fileName: args.fileName,
			fileSize: args.fileSize,
			mimeType: args.mimeType,
			caption: normalizeGalleryCaption(args.caption),
			sortOrder: existing.length,
			createdAt: now,
			updatedAt: now,
		})
	},
})

export const updateCaption = mutation({
	args: {
		id: v.id('serverGallery'),
		caption: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Gallery image not found')
		}
		await assertCanManageServer(ctx, item.serverId)

		await ctx.db.patch(args.id, {
			caption: normalizeGalleryCaption(args.caption),
			updatedAt: Date.now(),
		})
	},
})

export const reorder = mutation({
	args: {
		serverId: v.id('servers'),
		orderedIds: v.array(v.id('serverGallery')),
	},
	handler: async (ctx, args) => {
		await assertCanManageServer(ctx, args.serverId)
		const existing = await getServerGallery(ctx, args.serverId)
		const expectedIds = new Set(existing.map((item) => item._id))
		const orderedIds = new Set(args.orderedIds)

		if (
			orderedIds.size !== args.orderedIds.length ||
			args.orderedIds.length !== existing.length ||
			args.orderedIds.some((id) => !expectedIds.has(id))
		) {
			throw new Error(
				'Reorder must include every image from this server gallery exactly once',
			)
		}

		const now = Date.now()
		await Promise.all(
			args.orderedIds.map((id, index) =>
				ctx.db.patch(id, {
					sortOrder: index,
					updatedAt: now,
				}),
			),
		)
	},
})

export const remove = mutation({
	args: { id: v.id('serverGallery') },
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Gallery image not found')
		}
		await assertCanManageServer(ctx, item.serverId)

		await r2.deleteObject(ctx, item.r2Key)
		await ctx.db.delete(args.id)

		const remaining = (await getServerGallery(ctx, item.serverId)).filter(
			(galleryItem) => galleryItem._id !== args.id,
		)
		const now = Date.now()
		await Promise.all(
			remaining.map((galleryItem, index) =>
				ctx.db.patch(galleryItem._id, {
					sortOrder: index,
					updatedAt: now,
				}),
			),
		)
	},
})
