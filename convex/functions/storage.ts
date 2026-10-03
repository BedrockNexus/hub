import { ConvexError, v } from 'convex/values'
import { components, internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation, mutation, query } from '../_generated/server'
import { authComponent } from '../auth'
import { extractEditorMediaKeys } from '../lib/editorMedia'
import { canEditContent } from '../lib/permissions'
import {
	buildEntityImageR2ObjectKey,
	buildProfileMediaR2ObjectKey,
	isEditorMediaR2Key,
	isCdnR2Key,
	isManagedR2Key,
	isPrivateUploadR2Key,
	isTemporaryR2Key,
} from '../lib/r2Keys'
import { r2, resolveCdnObjectUrl, uploadsR2 } from '../lib/r2'
import { enforceRateLimit } from '../lib/rateLimits'

const R2_EDITOR_MEDIA_URL_EXPIRES_IN = 60 * 10
const STALE_MANAGED_UPLOAD_AGE_MS = 1000 * 60 * 60 * 24




async function assertCanManageImageEntity(
	ctx: MutationCtx,
	args: {
		resourceType: 'projects' | 'servers'
		entityId: string
		userId: string
		role?: string | null
	},
) {
	const actor = { _id: args.userId, role: args.role }
	if (args.resourceType === 'projects') {
		const id = ctx.db.normalizeId('projects', args.entityId)
		const project = id ? await ctx.db.get(id) : null
		if (!project) throw new ConvexError('Project not found')
		if (!(await canEditContent(ctx, project, actor, { allowSiteAdmin: true }))) {
			throw new ConvexError('You do not have permission to upload project images')
		}
		return
	}

	const id = ctx.db.normalizeId('servers', args.entityId)
	const server = id ? await ctx.db.get(id) : null
	if (!server) throw new ConvexError('Server not found')
	if (!(await canEditContent(ctx, server, actor, { allowSiteAdmin: true }))) {
		throw new ConvexError('You do not have permission to upload server images')
	}
}

const MEDIA_KEY_PATTERN =
	/^media\/(servers|projects|organizations|profiles|site)\/([^/]+)\/([^/]+)\/[^/]+$/
const RELEASE_KEY_PATTERN =
	/^(?:artifacts|downloads|uploads)\/projects\/([^/]+)\/releases\/[^/]+\/[^/]+$/
export const EDITOR_MEDIA_BACKFILL_SETTING = 'editorMediaReferencesBackfilled'

async function isEditorMediaReferenced(ctx: MutationCtx, key: string) {
	const references = await ctx.db
		.query('editorMediaReferences')
		.withIndex('by_key', (q) => q.eq('key', key))
		.take(50)
	for (const reference of references) {
		const markdown = await loadReferenceMarkdown(ctx, reference)
		if (extractEditorMediaKeys(markdown).includes(key)) {
			return true
		}
		// The source no longer embeds this upload.
		await ctx.db.delete(reference._id)
	}
	return false
}

async function loadReferenceMarkdown(
	ctx: MutationCtx,
	reference: Doc<'editorMediaReferences'>,
) {
	if (reference.sourceTable === 'servers') {
		const id = ctx.db.normalizeId('servers', reference.sourceId)
		return id ? (await ctx.db.get(id))?.description : undefined
	}
	if (reference.sourceTable === 'projects') {
		const id = ctx.db.normalizeId('projects', reference.sourceId)
		return id ? (await ctx.db.get(id))?.description : undefined
	}
	const id = ctx.db.normalizeId('projectVersions', reference.sourceId)
	return id ? (await ctx.db.get(id))?.changelog : undefined
}

/**
 * Whether a managed object is still used. Keys encode the record that owns
 * them, so each check reads only that record instead of scanning every table.
 * Unknown and legacy layouts are kept.
 */
async function isManagedKeyReferenced(
	ctx: MutationCtx,
	key: string,
	options: { editorMediaIndexed: boolean },
): Promise<boolean> {
	if (isTemporaryR2Key(key)) {
		return false
	}
	if (isEditorMediaR2Key(key)) {
		return options.editorMediaIndexed ? isEditorMediaReferenced(ctx, key) : true
	}

	const release = key.match(RELEASE_KEY_PATTERN)
	if (release) {
		const projectId = ctx.db.normalizeId('projects', release[1])
		if (!projectId) return false
		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', projectId))
			.collect()
		return versions.some(
			(version) =>
				version.r2Key === key ||
				version.uploadR2Key === key ||
				version.cdnR2Key === key,
		)
	}

	const media = key.match(MEDIA_KEY_PATTERN)
	if (!media) {
		return true
	}
	const [, entityType, entityId, mediaKind] = media
	if (entityType === 'servers') {
		const id = ctx.db.normalizeId('servers', entityId)
		const server = id ? await ctx.db.get(id) : null
		if (!(id && server)) return false
		if (server.logoR2Key === key || server.bannerR2Key === key) return true
		const gallery = await ctx.db
			.query('serverGallery')
			.withIndex('by_server', (q) => q.eq('serverId', id))
			.collect()
		return gallery.some((item) => item.r2Key === key)
	}
	if (entityType === 'projects') {
		const id = ctx.db.normalizeId('projects', entityId)
		const project = id ? await ctx.db.get(id) : null
		if (!(id && project)) return false
		if (project.iconR2Key === key || project.bannerR2Key === key) return true
		const gallery = await ctx.db
			.query('projectGallery')
			.withIndex('by_project', (q) => q.eq('projectId', id))
			.collect()
		return gallery.some((item) => item.r2Key === key)
	}
	if (entityType === 'organizations') {
		const profile = await ctx.db
			.query('organizationProfiles')
			.withIndex('by_organization', (q) => q.eq('organizationId', entityId))
			.unique()
		return profile?.bannerR2Key === key
	}
	if (entityType === 'profiles' && mediaKind === 'banner') {
		const profile = await ctx.db
			.query('userProfiles')
			.withIndex('by_user', (q) => q.eq('userId', entityId))
			.unique()
		return profile?.bannerR2Key === key
	}
	if (entityType === 'site') {
		const seo = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'seo'))
			.unique()
		const value = seo?.value as
			| { ogImageR2Key?: string; siteLogoR2Key?: string; faviconR2Key?: string }
			| undefined
		return (
			value?.ogImageR2Key === key ||
			value?.siteLogoR2Key === key ||
			value?.faviconR2Key === key
		)
	}
	return true
}

// =============================================================================
// STORAGE FUNCTIONS
// =============================================================================

export const generateImageUploadUrl = mutation({
	args: {
		resourceType: v.union(v.literal('projects'), v.literal('servers')),
		imageKind: v.union(
			v.literal('icon'),
			v.literal('logo'),
			v.literal('banner'),
			v.literal('gallery'),
		),
		entityId: v.string(),
		fileName: v.string(),
	},
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new ConvexError('You must be logged in to upload files')
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		if (args.resourceType === 'projects' && args.imageKind === 'logo') {
			throw new ConvexError('Projects use icons, not logos')
		}
		if (args.resourceType === 'servers' && args.imageKind === 'icon') {
			throw new ConvexError('Servers use logos, not icons')
		}
		await assertCanManageImageEntity(ctx, {
			resourceType: args.resourceType,
			entityId: args.entityId,
			userId: user._id,
			role: user.role,
		})

		const key = buildEntityImageR2ObjectKey({
			resourceType: args.resourceType,
			entityId: args.entityId,
			imageKind: args.imageKind,
			fileName: args.fileName,
		})

		return r2.generateUploadUrl(key)
	},
})

export const generateEditorMediaUploadUrl = mutation({
	args: {
		mediaKind: v.union(
			v.literal('audio'),
			v.literal('file'),
			v.literal('image'),
			v.literal('video'),
		),
		fileName: v.string(),
	},
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new ConvexError('You must be logged in to upload files')
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)

		const key = buildProfileMediaR2ObjectKey({
			userId: user._id,
			mediaKind: `editor-${args.mediaKind}`,
			fileName: args.fileName,
		})

		return r2.generateUploadUrl(key)
	},
})

export const getEditorMediaUrl = query({
	args: { key: v.string() },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		if (!isEditorMediaR2Key(args.key)) return null

		const metadata = await r2.getMetadata(ctx, args.key)
		if (!metadata) return null

		return resolveCdnObjectUrl(args.key, R2_EDITOR_MEDIA_URL_EXPIRES_IN)
	},
})

export const deleteR2Object = mutation({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new ConvexError('You must be logged in to delete files')
		await enforceRateLimit(
			ctx,
			'fileDelete',
			user._id,
			'Too many file deletion requests. Please wait before trying again.',
		)

		const canDelete =
			isEditorMediaR2Key(args.key, user._id) ||
			isTemporaryR2Key(args.key, user._id) ||
			(args.key.startsWith(`${user._id}/`) && isManagedR2Key(args.key))
		if (!canDelete) {
			throw new ConvexError('You can only delete your own managed uploads')
		}

		const target = isPrivateUploadR2Key(args.key) ? uploadsR2 : r2
		await target.deleteObject(ctx, args.key)
		return { success: true }
	},
})

export const cleanupStaleManagedR2Uploads = internalMutation({
	args: {
		bucket: v.optional(v.union(v.literal('cdn'), v.literal('uploads'))),
		limit: v.optional(v.number()),
		cursor: v.optional(v.union(v.string(), v.null())),
		olderThanMs: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const bucket = args.bucket ?? 'cdn'
		const target = bucket === 'uploads' ? uploadsR2 : r2
		const acceptsKey = bucket === 'uploads' ? isPrivateUploadR2Key : isCdnR2Key
		const now = Date.now()
		// Until existing descriptions are indexed, editor uploads are never
		// deleted (functions/storageMigrations:backfillEditorMediaReferences).
		const editorMediaIndexed = Boolean(
			await ctx.db
				.query('siteSettings')
				.withIndex('by_key', (q) => q.eq('key', EDITOR_MEDIA_BACKFILL_SETTING))
				.unique(),
		)
		const cutoff =
			now - (args.olderThanMs ?? STALE_MANAGED_UPLOAD_AGE_MS)
		const expiredReservations = await ctx.db
			.query('projectArtifactUploads')
			.withIndex('by_status_expires', (q) =>
				q.eq('status', 'pending').lt('expiresAt', now),
			)
			.take(Math.min(args.limit ?? 100, 250))

		for (const reservation of expiredReservations) {
			const reservationBucket = isPrivateUploadR2Key(reservation.r2Key)
				? uploadsR2
				: r2
			await reservationBucket.deleteObject(ctx, reservation.r2Key)
			await ctx.db.delete(reservation._id)
		}
		const page = await target.listMetadata(
			ctx,
			Math.min(args.limit ?? 100, 250),
			args.cursor ?? null,
		)
		let deleted = 0

		for (const metadata of page.page) {
			if (!isManagedR2Key(metadata.key) || !acceptsKey(metadata.key)) {
				continue
			}
			const lastModified = Date.parse(metadata.lastModified)
			if (Number.isNaN(lastModified) || lastModified > cutoff) {
				continue
			}
			if (
				await isManagedKeyReferenced(ctx, metadata.key, { editorMediaIndexed })
			) {
				continue
			}

			await target.deleteObject(ctx, metadata.key)
			deleted += 1
		}

		if (!page.isDone && page.continueCursor) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.storage.cleanupStaleManagedR2Uploads,
				{ ...args, bucket, cursor: page.continueCursor },
			)
		} else if (bucket === 'cdn') {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.storage.cleanupStaleManagedR2Uploads,
				{ ...args, bucket: 'uploads', cursor: null },
			)
		}

		return {
			deleted,
			bucket,
			expiredReservations: expiredReservations.length,
			continueCursor: page.continueCursor,
			isDone: page.isDone,
		}
	},
})
