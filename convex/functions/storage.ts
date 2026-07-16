import { ConvexError, v } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import { internalMutation, mutation, query } from '../_generated/server'
import { authComponent } from '../auth'
import {
	buildEntityImageR2ObjectKey,
	buildUserR2ObjectKey,
	isEditorMediaR2Key,
	isManagedR2Key,
} from '../lib/r2Keys'
import { r2 } from '../lib/r2'
import { enforceRateLimit } from '../lib/rateLimits'

const R2_EDITOR_MEDIA_URL_EXPIRES_IN = 60 * 10
const STALE_MANAGED_UPLOAD_AGE_MS = 1000 * 60 * 60 * 24

async function collectReferencedManagedR2Keys(ctx: MutationCtx) {
	const keys = new Set<string>()

	const servers = await ctx.db.query('servers').collect()
	for (const server of servers) {
		if (server.logoR2Key) keys.add(server.logoR2Key)
		if (server.bannerR2Key) keys.add(server.bannerR2Key)
	}

	const serverGallery = await ctx.db.query('serverGallery').collect()
	for (const item of serverGallery) {
		keys.add(item.r2Key)
	}

	const projects = await ctx.db.query('projects').collect()
	for (const project of projects) {
		if (project.iconR2Key) keys.add(project.iconR2Key)
		if (project.bannerR2Key) keys.add(project.bannerR2Key)
	}

	const projectGallery = await ctx.db.query('projectGallery').collect()
	for (const item of projectGallery) {
		keys.add(item.r2Key)
	}

	const projectVersions = await ctx.db.query('projectVersions').collect()
	for (const version of projectVersions) {
		keys.add(version.r2Key)
	}

	const organizationProfiles = await ctx.db.query('organizationProfiles').collect()
	for (const profile of organizationProfiles) {
		if (profile.bannerR2Key) keys.add(profile.bannerR2Key)
	}

	const userProfiles = await ctx.db.query('userProfiles').collect()
	for (const profile of userProfiles) {
		if (profile.bannerR2Key) keys.add(profile.bannerR2Key)
	}

	const seoSetting = await ctx.db
		.query('siteSettings')
		.withIndex('by_key', (q) => q.eq('key', 'seo'))
		.unique()
	const seo = seoSetting?.value as
		| {
				faviconR2Key?: string
				ogImageR2Key?: string
				siteLogoR2Key?: string
		  }
		| undefined
	if (seo?.siteLogoR2Key) {
		keys.add(seo.siteLogoR2Key)
	}
	if (seo?.ogImageR2Key) {
		keys.add(seo.ogImageR2Key)
	}
	if (seo?.faviconR2Key) {
		keys.add(seo.faviconR2Key)
	}

	return keys
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

		const key = buildEntityImageR2ObjectKey({
			userId: user._id,
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

		const key = buildUserR2ObjectKey({
			userId: user._id,
			resourceType: 'editor',
			segments: ['media', args.mediaKind],
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

		return r2.getUrl(args.key, { expiresIn: R2_EDITOR_MEDIA_URL_EXPIRES_IN })
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

		if (!args.key.startsWith(`${user._id}/`) || !isManagedR2Key(args.key)) {
			throw new ConvexError('You can only delete your own managed uploads')
		}

		await r2.deleteObject(ctx, args.key)
		return { success: true }
	},
})

export const cleanupStaleManagedR2Uploads = internalMutation({
	args: {
		limit: v.optional(v.number()),
		cursor: v.optional(v.union(v.string(), v.null())),
		olderThanMs: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const referencedKeys = await collectReferencedManagedR2Keys(ctx)
		const cutoff =
			Date.now() - (args.olderThanMs ?? STALE_MANAGED_UPLOAD_AGE_MS)
		const page = await r2.listMetadata(
			ctx,
			Math.min(args.limit ?? 250, 500),
			args.cursor ?? null,
		)
		let deleted = 0

		for (const metadata of page.page) {
			if (!isManagedR2Key(metadata.key)) {
				continue
			}
			if (referencedKeys.has(metadata.key)) {
				continue
			}

			const lastModified = Date.parse(metadata.lastModified)
			if (Number.isNaN(lastModified) || lastModified > cutoff) {
				continue
			}

			await r2.deleteObject(ctx, metadata.key)
			deleted += 1
		}

		return {
			deleted,
			continueCursor: page.continueCursor,
			isDone: page.isDone,
		}
	},
})
