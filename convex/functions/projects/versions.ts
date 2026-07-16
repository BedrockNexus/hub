import { v } from 'convex/values'
import { components } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { isPublicProject } from '../../lib/contentVisibility'
import { r2 } from '../../lib/r2'
import { buildProjectVersionR2ObjectKey } from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'

const VERSION_DOWNLOAD_URL_EXPIRES_IN = 60 * 5

function getUtcDayKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 10)
}

function getUtcMonthKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 7)
}

function withDownloadUrl<T extends { _id: Id<'projectVersions'> }>(
	version: T,
) {
	return {
		...version,
		downloadUrl: `/api/projects/versions/${version._id}/download`,
	}
}

async function canModifyProject(
	ctx: MutationCtx | QueryCtx,
	project: { ownerType: 'user' | 'organization'; ownerId: string },
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
	errorMessage: string,
) {
	const user = await authComponent.getAuthUser(ctx)
	if (!user) {
		throw new Error(errorMessage)
	}

	const project = await ctx.db.get(projectId)
	if (!project) {
		throw new Error('Project not found')
	}

	if (
		user.role !== 'admin' &&
		!(await canModifyProject(ctx, project, user._id))
	) {
		throw new Error('You do not have permission to manage project versions')
	}

	return { project, user }
}

export const list = query({
	args: {
		projectId: v.id('projects'),
	},
	handler: async (ctx, args) => {
		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.order('desc')
			.collect()

		return versions.map(withDownloadUrl)
	},
})

export const listPublic = query({
	args: {
		projectId: v.id('projects'),
	},
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (!project || !isPublicProject(project)) {
			return []
		}

		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.order('desc')
			.collect()

		return versions.map(withDownloadUrl)
	},
})

export const getLatest = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const version = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.order('desc')
			.first()

		return version ? withDownloadUrl(version) : null
	},
})

export const getByVersion = query({
	args: {
		projectId: v.id('projects'),
		version: v.string(),
	},
	handler: async (ctx, args) => {
		const version = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', args.projectId).eq('version', args.version),
			)
			.first()

		return version ? withDownloadUrl(version) : null
	},
})

export const generateVersionUploadUrl = mutation({
	args: {
		projectId: v.id('projects'),
		version: v.string(),
		fileName: v.string(),
	},
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const { user } = await assertCanManageProject(
			ctx,
			args.projectId,
			'You must be logged in to upload version files',
		)
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)

		const key = buildProjectVersionR2ObjectKey({
			userId: user._id,
			projectId: args.projectId,
			version: args.version,
			fileName: args.fileName,
		})

		return r2.generateUploadUrl(key)
	},
})

export const create = mutation({
	args: {
		projectId: v.id('projects'),
		version: v.string(),
		changelog: v.optional(v.string()),
		r2Key: v.string(),
		fileName: v.string(),
		fileSize: v.number(),
		gameVersions: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		await assertCanManageProject(
			ctx,
			args.projectId,
			'You must be logged in to publish versions',
		)

		const existing = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', args.projectId).eq('version', args.version),
			)
			.first()

		if (existing) {
			throw new Error(`Version ${args.version} already exists`)
		}

		const now = Date.now()

		const versionId = await ctx.db.insert('projectVersions', {
			projectId: args.projectId,
			version: args.version,
			changelog: args.changelog,
			r2Key: args.r2Key,
			fileName: args.fileName,
			fileSize: args.fileSize,
			gameVersions: args.gameVersions,
			downloads: 0,
			createdAt: now,
		})

		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.collect()

		await ctx.db.patch(args.projectId, {
			latestVersionId: versionId,
			latestVersionString: args.version,
			latestVersionAt: now,
			versionCount: versions.length,
			updatedAt: now,
		})

		return versionId
	},
})

export const createDownloadUrl = mutation({
	args: {
		versionId: v.id('projectVersions'),
	},
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version) {
			return {
				ok: false as const,
				code: 'VERSION_NOT_FOUND' as const,
				message: 'This release is no longer available.',
			}
		}

		const project = await ctx.db.get(version.projectId)
		if (!project || !isPublicProject(project)) {
			return {
				ok: false as const,
				code: 'VERSION_UNAVAILABLE' as const,
				message: 'This release is not publicly available.',
			}
		}

		const user = await authComponent.safeGetAuthUser(ctx)
		await enforceRateLimit(
			ctx,
			'versionDownload',
			user?._id
				? `user:${user._id}:${version._id}`
				: `anonymous:${version._id}`,
			'Too many download requests. Please wait before trying again.',
		)

		const metadata = await r2.getMetadata(ctx, version.r2Key)
		if (!metadata) {
			return {
				ok: false as const,
				code: 'FILE_MISSING' as const,
				message:
					'The release file is temporarily unavailable. The creator may need to upload it again.',
			}
		}

		const url = await r2.getUrl(version.r2Key, {
			expiresIn: VERSION_DOWNLOAD_URL_EXPIRES_IN,
		})

		await ctx.db.patch(args.versionId, {
			downloads: version.downloads + 1,
		})

		await updateProjectDownloadStats(ctx, version.projectId, {
			recordDownload: true,
		})
		await ctx.db.insert('analyticsEvents', {
			targetType: 'project',
			targetId: version.projectId,
			eventType: 'download',
			userId: user?._id,
			dayKey: getUtcDayKey(Date.now()),
			createdAt: Date.now(),
		})

		return {
			ok: true as const,
			fileName: version.fileName,
			url,
			expiresIn: VERSION_DOWNLOAD_URL_EXPIRES_IN,
		}
	},
})

export const remove = mutation({
	args: { id: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.id)
		if (!version) {
			throw new Error('Version not found')
		}

		await assertCanManageProject(
			ctx,
			version.projectId,
			'You must be logged in to delete versions',
		)

		await r2.deleteObject(ctx, version.r2Key)
		await ctx.db.delete(args.id)
		await updateProjectDownloadStats(ctx, version.projectId)

		const latestVersion = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', version.projectId))
			.order('desc')
			.first()
		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', version.projectId))
			.collect()

		await ctx.db.patch(version.projectId, {
			latestVersionId: latestVersion?._id,
			latestVersionString: latestVersion?.version,
			latestVersionAt: latestVersion?.createdAt,
			versionCount: versions.length,
			updatedAt: Date.now(),
		})
	},
})

async function updateProjectDownloadStats(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
	options: { recordDownload?: boolean } = {},
) {
	const versions = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.collect()

	const totalDownloads = versions.reduce(
		(sum, version) => sum + version.downloads,
		0,
	)

	const now = Date.now()
	const dayKey = getUtcDayKey(now)
	const monthKey = getUtcMonthKey(now)

	const stats = await ctx.db
		.query('projectStats')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.first()

	if (!stats) {
		await ctx.db.insert('projectStats', {
			projectId,
			totalDownloads,
			totalDownloadsToday: options.recordDownload ? 1 : 0,
			totalDownloadsThisMonth: options.recordDownload ? 1 : 0,
			dailyKey: dayKey,
			monthlyKey: monthKey,
			averageRating: 0,
			reviewCount: 0,
			updatedAt: now,
		})
		return
	}

	const totalDownloadsToday = options.recordDownload
		? stats.dailyKey === dayKey
			? (stats.totalDownloadsToday ?? 0) + 1
			: 1
		: stats.dailyKey === dayKey
			? (stats.totalDownloadsToday ?? 0)
			: 0
	const totalDownloadsThisMonth = options.recordDownload
		? stats.monthlyKey === monthKey
			? (stats.totalDownloadsThisMonth ?? 0) + 1
			: 1
		: stats.monthlyKey === monthKey
			? (stats.totalDownloadsThisMonth ?? 0)
			: 0

	await ctx.db.patch(stats._id, {
		totalDownloads,
		totalDownloadsToday,
		totalDownloadsThisMonth,
		dailyKey: dayKey,
		monthlyKey: monthKey,
		updatedAt: now,
	})
}
