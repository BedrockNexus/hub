import { ConvexError, v } from 'convex/values'
import { components } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { internalMutation, mutation, query } from '../_generated/server'
import { authComponent } from '../auth'
import {
	buildEntityImageR2ObjectKey,
	buildProfileMediaR2ObjectKey,
	isEditorMediaR2Key,
	isManagedR2Key,
	isTemporaryR2Key,
} from '../lib/r2Keys'
import { r2 } from '../lib/r2'
import { enforceRateLimit } from '../lib/rateLimits'

const R2_EDITOR_MEDIA_URL_EXPIRES_IN = 60 * 10
const STALE_MANAGED_UPLOAD_AGE_MS = 1000 * 60 * 60 * 24

function collectEditorMediaKeysFromMarkdown(
	keys: Set<string>,
	markdown?: string,
) {
	if (!markdown) return
	const matches = markdown.matchAll(
		/\/api\/r2\/editor-media\/([^\s)"'<>]+)/g,
	)
	for (const match of matches) {
		try {
			keys.add(
				match[1]
					.split('/')
					.map((segment) => decodeURIComponent(segment))
					.join('/'),
			)
		} catch {
			// Invalid encoded URLs are not valid managed references.
		}
	}
}

async function isOrganizationMember(
	ctx: MutationCtx,
	organizationId: string,
	userId: string,
) {
	const member = (await ctx.runQuery(
		components.betterAuth.adapter.findOne,
		{
			model: 'member',
			where: [
				{ field: 'organizationId', value: organizationId },
				{ field: 'userId', value: userId },
			],
		},
	)) as { id?: string } | null
	return Boolean(member)
}

async function assertCanManageImageEntity(
	ctx: MutationCtx,
	args: {
		resourceType: 'projects' | 'servers'
		entityId: string
		userId: string
		role?: string | null
	},
) {
	if (args.role === 'admin') return

	if (args.resourceType === 'projects') {
		const id = ctx.db.normalizeId('projects', args.entityId)
		const project = id ? await ctx.db.get(id) : null
		if (!project) throw new ConvexError('Project not found')
		if (project.ownerType === 'user' && project.ownerId === args.userId) return
		if (
			project.ownerType === 'organization' &&
			(await isOrganizationMember(ctx, project.ownerId, args.userId))
		) {
			return
		}
		throw new ConvexError('You do not have permission to upload project images')
	}

	const id = ctx.db.normalizeId('servers', args.entityId)
	const server = id ? await ctx.db.get(id) : null
	if (!server) throw new ConvexError('Server not found')
	if (
		server.ownerType === 'user' &&
		(server.ownerId === args.userId || server.registeredBy === args.userId)
	) {
		return
	}
	if (
		server.ownerType === 'organization' &&
		(await isOrganizationMember(ctx, server.ownerId, args.userId))
	) {
		return
	}
	throw new ConvexError('You do not have permission to upload server images')
}

async function collectReferencedManagedR2Keys(ctx: MutationCtx) {
	const keys = new Set<string>()

	const servers = await ctx.db.query('servers').collect()
	for (const server of servers) {
		if (server.logoR2Key) keys.add(server.logoR2Key)
		if (server.bannerR2Key) keys.add(server.bannerR2Key)
		collectEditorMediaKeysFromMarkdown(keys, server.description)
	}

	const serverGallery = await ctx.db.query('serverGallery').collect()
	for (const item of serverGallery) {
		keys.add(item.r2Key)
	}

	const projects = await ctx.db.query('projects').collect()
	for (const project of projects) {
		if (project.iconR2Key) keys.add(project.iconR2Key)
		if (project.bannerR2Key) keys.add(project.bannerR2Key)
		collectEditorMediaKeysFromMarkdown(keys, project.description)
	}

	const projectGallery = await ctx.db.query('projectGallery').collect()
	for (const item of projectGallery) {
		keys.add(item.r2Key)
	}

	const projectVersions = await ctx.db.query('projectVersions').collect()
	for (const version of projectVersions) {
		keys.add(version.r2Key)
		collectEditorMediaKeysFromMarkdown(keys, version.changelog)
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

		const canDelete =
			isEditorMediaR2Key(args.key, user._id) ||
			isTemporaryR2Key(args.key, user._id) ||
			(args.key.startsWith(`${user._id}/`) && isManagedR2Key(args.key))
		if (!canDelete) {
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
		const now = Date.now()
		const referencedKeys = await collectReferencedManagedR2Keys(ctx)
		const cutoff =
			now - (args.olderThanMs ?? STALE_MANAGED_UPLOAD_AGE_MS)
		const expiredReservations = await ctx.db
			.query('projectArtifactUploads')
			.withIndex('by_status_expires', (q) =>
				q.eq('status', 'pending').lt('expiresAt', now),
			)
			.take(Math.min(args.limit ?? 250, 500))

		for (const reservation of expiredReservations) {
			await r2.deleteObject(ctx, reservation.r2Key)
			await ctx.db.delete(reservation._id)
		}
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
			expiredReservations: expiredReservations.length,
			continueCursor: page.continueCursor,
			isDone: page.isDone,
		}
	},
})
