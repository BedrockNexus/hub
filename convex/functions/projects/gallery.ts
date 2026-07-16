import { v } from 'convex/values'
import { components } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { isPublicProject } from '../../lib/contentVisibility'
import {
	assertValidGalleryImageMetadata,
	MAX_GALLERY_IMAGES,
	normalizeGalleryCaption,
} from '../../lib/gallery'
import { r2 } from '../../lib/r2'
import { buildEntityImageR2ObjectKey } from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'

const GALLERY_IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

type ProjectOwner = {
	ownerType: 'user' | 'organization'
	ownerId: string
}

async function canModifyProject(
	ctx: MutationCtx | QueryCtx,
	project: ProjectOwner,
	userId: string,
) {
	if (project.ownerType === 'user') {
		return project.ownerId === userId
	}

	const membersResult = (await ctx.runQuery(
		components.betterAuth.adapter.findMany,
		{
			model: 'member',
			where: [{ field: 'organizationId', value: project.ownerId }],
			paginationOpts: { cursor: null, numItems: 100 },
		},
	)) as { page: Array<{ userId: string }> }

	return (membersResult.page ?? []).some((member) => member.userId === userId)
}

async function assertCanManageProject(
	ctx: MutationCtx | QueryCtx,
	projectId: Id<'projects'>,
) {
	const user = await authComponent.getAuthUser(ctx)
	if (!user) {
		throw new Error('You must be logged in to manage gallery images')
	}

	const project = await ctx.db.get(projectId)
	if (!project) {
		throw new Error('Project not found')
	}
	if (
		user.role !== 'admin' &&
		!(await canModifyProject(ctx, project, user._id))
	) {
		throw new Error('You do not have permission to manage this gallery')
	}

	return { project, user }
}

async function getProjectGallery(
	ctx: MutationCtx | QueryCtx,
	projectId: Id<'projects'>,
) {
	return ctx.db
		.query('projectGallery')
		.withIndex('by_project_sort', (q) => q.eq('projectId', projectId))
		.collect()
}

async function assertProjectGalleryHasCapacity(
	ctx: MutationCtx | QueryCtx,
	projectId: Id<'projects'>,
) {
	const items = await getProjectGallery(ctx, projectId)
	if (items.length >= MAX_GALLERY_IMAGES) {
		throw new Error(
			`Project galleries can contain up to ${MAX_GALLERY_IMAGES} images`,
		)
	}
	return items
}

async function enrichGalleryItem(item: Doc<'projectGallery'>) {
	return {
		...item,
		url: await r2.getUrl(item.r2Key, {
			expiresIn: GALLERY_IMAGE_URL_EXPIRES_IN,
		}),
	}
}

export const listPublic = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (!project || !isPublicProject(project)) {
			return []
		}

		const items = await ctx.db
			.query('projectGallery')
			.withIndex('by_project_sort', (q) =>
				q.eq('projectId', args.projectId),
			)
			.collect()

		return Promise.all(items.map(enrichGalleryItem))
	},
})

export const listMine = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		await assertCanManageProject(ctx, args.projectId)

		const items = await ctx.db
			.query('projectGallery')
			.withIndex('by_project_sort', (q) =>
				q.eq('projectId', args.projectId),
			)
			.collect()

		return Promise.all(items.map(enrichGalleryItem))
	},
})

export const generateUploadUrl = mutation({
	args: {
		projectId: v.id('projects'),
		fileName: v.string(),
	},
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const { user } = await assertCanManageProject(ctx, args.projectId)
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		await assertProjectGalleryHasCapacity(ctx, args.projectId)
		const key = buildEntityImageR2ObjectKey({
			userId: user._id,
			resourceType: 'projects',
			entityId: args.projectId,
			imageKind: 'gallery',
			fileName: args.fileName,
		})

		return r2.generateUploadUrl(key)
	},
})

export const add = mutation({
	args: {
		projectId: v.id('projects'),
		r2Key: v.string(),
		fileName: v.string(),
		fileSize: v.number(),
		mimeType: v.string(),
		caption: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { user } = await assertCanManageProject(ctx, args.projectId)
		assertValidGalleryImageMetadata(args)
		const existing = await assertProjectGalleryHasCapacity(ctx, args.projectId)
		const now = Date.now()

		return await ctx.db.insert('projectGallery', {
			projectId: args.projectId,
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
		id: v.id('projectGallery'),
		caption: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Gallery image not found')
		}
		await assertCanManageProject(ctx, item.projectId)

		await ctx.db.patch(args.id, {
			caption: normalizeGalleryCaption(args.caption),
			updatedAt: Date.now(),
		})
	},
})

export const reorder = mutation({
	args: {
		projectId: v.id('projects'),
		orderedIds: v.array(v.id('projectGallery')),
	},
	handler: async (ctx, args) => {
		await assertCanManageProject(ctx, args.projectId)
		const existing = await getProjectGallery(ctx, args.projectId)
		const expectedIds = new Set(existing.map((item) => item._id))
		const orderedIds = new Set(args.orderedIds)

		if (
			orderedIds.size !== args.orderedIds.length ||
			args.orderedIds.length !== existing.length ||
			args.orderedIds.some((id) => !expectedIds.has(id))
		) {
			throw new Error(
				'Reorder must include every image from this project gallery exactly once',
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
	args: { id: v.id('projectGallery') },
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Gallery image not found')
		}
		await assertCanManageProject(ctx, item.projectId)

		await r2.deleteObject(ctx, item.r2Key)
		await ctx.db.delete(args.id)

		const remaining = (await getProjectGallery(ctx, item.projectId)).filter(
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
