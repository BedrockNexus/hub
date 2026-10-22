import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from '../../_generated/dataModel'
import { type MutationCtx, type QueryCtx, query } from '../../_generated/server'
import { authedMutation, authedQuery } from '../../lib/functions'
import { MAX_GALLERY_IMAGES, normalizeGalleryCaption } from '../../lib/gallery'
import { validateEntityImageUpload } from '../../lib/media'
import type { AppUser } from '../../lib/plugins/access'
import { r2, resolveCdnObjectUrl } from '../../lib/r2'
import { buildEntityImageR2ObjectKey } from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'
import { requireOwnedDraft } from './publishing/model'

/**
 * Screenshots on a plugin's page, managed from its dashboard. Like project
 * galleries they change at once, without waiting for a version review. The
 * dashboard addresses the plugin by its draft, which carries ownership.
 */

const GALLERY_IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

const galleryItemValidator = v.object({
	_id: v.id('pluginGallery'),
	caption: v.optional(v.string()),
	fileName: v.string(),
	fileSize: v.number(),
	mimeType: v.string(),
	sortOrder: v.number(),
	url: v.string(),
})

async function requireManagedPlugin(
	ctx: QueryCtx | MutationCtx,
	draftId: Id<'pluginPublishingDrafts'>,
	user: AppUser,
) {
	const draft = await requireOwnedDraft(ctx, draftId, user)
	if (!draft.projectId) {
		throw new ConvexError({
			code: 'PLUGIN_NOT_CREATED',
			message: 'Pick a build workflow before adding gallery images.',
		})
	}
	return draft.projectId
}

/** The plugin an existing gallery image belongs to, when the user manages it. */
async function requireManagedItem(
	ctx: MutationCtx,
	id: Id<'pluginGallery'>,
	user: AppUser,
) {
	const item = await ctx.db.get('pluginGallery', id)
	if (!item) {
		throw new ConvexError({
			code: 'GALLERY_IMAGE_NOT_FOUND',
			message: 'The gallery image was not found.',
		})
	}
	const draft = await ctx.db
		.query('pluginPublishingDrafts')
		.withIndex('by_project_id', (q) => q.eq('projectId', item.pluginId))
		.first()
	if (!draft) {
		throw new ConvexError({
			code: 'GALLERY_IMAGE_NOT_FOUND',
			message: 'The gallery image was not found.',
		})
	}
	await requireOwnedDraft(ctx, draft._id, user)
	return item
}

async function listGallery(
	ctx: QueryCtx | MutationCtx,
	pluginId: Id<'plugins'>,
) {
	return await ctx.db
		.query('pluginGallery')
		.withIndex('by_plugin_sort', (q) => q.eq('pluginId', pluginId))
		.take(MAX_GALLERY_IMAGES + 1)
}

async function withUrls(items: Doc<'pluginGallery'>[]) {
	return await Promise.all(
		items.map(async (item) => ({
			_id: item._id,
			caption: item.caption,
			fileName: item.fileName,
			fileSize: item.fileSize,
			mimeType: item.mimeType,
			sortOrder: item.sortOrder,
			url: await resolveCdnObjectUrl(
				item.r2Key,
				GALLERY_IMAGE_URL_EXPIRES_IN,
			),
		})),
	)
}

async function requireCapacity(ctx: MutationCtx, pluginId: Id<'plugins'>) {
	const items = await listGallery(ctx, pluginId)
	if (items.length >= MAX_GALLERY_IMAGES) {
		throw new ConvexError({
			code: 'GALLERY_FULL',
			message: `Plugin galleries can contain up to ${MAX_GALLERY_IMAGES} images.`,
		})
	}
	return items
}

/** Renumbers a gallery after an image is removed. */
async function renumber(ctx: MutationCtx, pluginId: Id<'plugins'>) {
	const now = Date.now()
	const items = await listGallery(ctx, pluginId)
	await Promise.all(
		items.map((item, index) =>
			ctx.db.patch('pluginGallery', item._id, {
				sortOrder: index,
				updatedAt: now,
			}),
		),
	)
}

export const listPublic = query({
	args: { pluginId: v.id('plugins') },
	returns: v.array(galleryItemValidator),
	handler: async (ctx, args) => {
		const plugin = await ctx.db.get('plugins', args.pluginId)
		if (plugin?.visibility !== 'public' || plugin.status !== 'published') {
			return []
		}
		return await withUrls(await listGallery(ctx, args.pluginId))
	},
})

export const listMine = authedQuery({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.array(galleryItemValidator),
	handler: async (ctx, args) => {
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		return draft.projectId
			? await withUrls(await listGallery(ctx, draft.projectId))
			: []
	},
})

export const generateUploadUrl = authedMutation({
	args: { draftId: v.id('pluginPublishingDrafts'), fileName: v.string() },
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			ctx.user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		const pluginId = await requireManagedPlugin(ctx, args.draftId, ctx.user)
		await requireCapacity(ctx, pluginId)
		const key = buildEntityImageR2ObjectKey({
			resourceType: 'plugins',
			entityId: pluginId,
			imageKind: 'gallery',
			fileName: args.fileName,
		})
		return await r2.generateUploadUrl(key)
	},
})

export const add = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		r2Key: v.string(),
		fileName: v.string(),
		caption: v.optional(v.string()),
	},
	returns: v.id('pluginGallery'),
	handler: async (ctx, args) => {
		const pluginId = await requireManagedPlugin(ctx, args.draftId, ctx.user)
		const metadata = await validateEntityImageUpload(ctx, {
			key: args.r2Key,
			resourceType: 'plugins',
			entityId: pluginId,
			imageKind: 'gallery',
		})
		const existing = await requireCapacity(ctx, pluginId)
		const now = Date.now()
		return await ctx.db.insert('pluginGallery', {
			pluginId,
			ownerId: ctx.user._id,
			r2Key: args.r2Key,
			fileName: args.fileName,
			fileSize: metadata.size,
			mimeType: metadata.contentType,
			caption: normalizeGalleryCaption(args.caption),
			sortOrder: existing.length,
			createdAt: now,
			updatedAt: now,
		})
	},
})

export const updateCaption = authedMutation({
	args: { id: v.id('pluginGallery'), caption: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireManagedItem(ctx, args.id, ctx.user)
		await ctx.db.patch('pluginGallery', args.id, {
			caption: normalizeGalleryCaption(args.caption),
			updatedAt: Date.now(),
		})
		return null
	},
})

export const reorder = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		orderedIds: v.array(v.id('pluginGallery')),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const pluginId = await requireManagedPlugin(ctx, args.draftId, ctx.user)
		const existing = await listGallery(ctx, pluginId)
		const expected = new Set(existing.map((item) => item._id))
		if (
			new Set(args.orderedIds).size !== args.orderedIds.length ||
			args.orderedIds.length !== existing.length ||
			args.orderedIds.some((id) => !expected.has(id))
		) {
			throw new ConvexError({
				code: 'INVALID_ORDER',
				message: 'Reorder must include every gallery image exactly once.',
			})
		}
		const now = Date.now()
		await Promise.all(
			args.orderedIds.map((id, index) =>
				ctx.db.patch('pluginGallery', id, {
					sortOrder: index,
					updatedAt: now,
				}),
			),
		)
		return null
	},
})

export const remove = authedMutation({
	args: { id: v.id('pluginGallery') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const item = await requireManagedItem(ctx, args.id, ctx.user)
		await r2.deleteObject(ctx, item.r2Key)
		await ctx.db.delete('pluginGallery', item._id)
		await renumber(ctx, item.pluginId)
		return null
	},
})
