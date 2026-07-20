import { v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import {
	internalMutation,
	mutation,
	query,
} from '../../_generated/server'
import { authComponent } from '../../auth'
import { isPublicProject } from '../../lib/contentVisibility'
import {
	assertPrivateUploadBucketConfigured,
	cdnR2,
	resolveCdnObjectUrl,
	uploadsR2,
} from '../../lib/r2'
import {
	buildProjectUploadR2ObjectKey,
	isCdnR2Key,
} from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'
import {
	getProjectArtifactPolicy,
	normalizeProjectType,
	validateProjectArtifactFile,
} from '../../../lib/project-artifacts'
import { skinModel } from '../../schemas/projects'

const VERSION_DOWNLOAD_URL_EXPIRES_IN = 60 * 5
const ARTIFACT_UPLOAD_EXPIRES_IN_MS = 1000 * 60 * 60 * 24

function isValidatedVersion(version: { validationStatus?: string }) {
	return version.validationStatus === undefined || version.validationStatus === 'valid'
}

function getPublishedArtifactKey(version: {
	r2Key: string
	uploadR2Key?: string
	cdnR2Key?: string
}) {
	if (version.cdnR2Key) return version.cdnR2Key
	if (!version.uploadR2Key && isCdnR2Key(version.r2Key)) {
		return version.r2Key
	}
	return undefined
}

function assertValidVersionString(version: string) {
	if (version.length < 1 || version.length > 32) {
		throw new Error('Invalid version string')
	}
	if (!/^[a-zA-Z0-9._+-]+$/.test(version)) {
		throw new Error(
			'Version may only contain letters, numbers, dots, underscores, hyphens, and plus signs',
		)
	}
}

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

function withCreatorDownloadUrl<
	T extends { _id: Id<'projectVersions'>; validationStatus?: string },
>(version: T) {
	return {
		...version,
		downloadUrl: isValidatedVersion(version)
			? `/api/projects/versions/${version._id}/download`
			: undefined,
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

		return versions.map(withCreatorDownloadUrl)
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

		return versions
			.filter(
				(version) =>
					isValidatedVersion(version) &&
					Boolean(getPublishedArtifactKey(version)),
			)
			.map((version) => withDownloadUrl(version))
	},
})

export const getPublicByVersion = query({
	args: { slug: v.string(), version: v.string() },
	handler: async (ctx, args) => {
		const project = await ctx.db
			.query('projects')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique()
		if (!project || !isPublicProject(project)) return null
		const version = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', project._id).eq('version', args.version),
			)
			.unique()
		if (
			!version ||
			!isValidatedVersion(version) ||
			!getPublishedArtifactKey(version)
		) return null
		return { ...withDownloadUrl(version), project: { name: project.name, slug: project.slug } }
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

		return version &&
			isValidatedVersion(version) &&
			getPublishedArtifactKey(version)
			? withDownloadUrl(version)
			: null
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

		return version &&
			isValidatedVersion(version) &&
			getPublishedArtifactKey(version)
			? withDownloadUrl(version)
			: null
	},
})

export const generateVersionUploadUrl = mutation({
	args: {
		projectId: v.id('projects'),
		version: v.string(),
		fileName: v.string(),
		fileSize: v.number(),
	},
	returns: v.object({
		uploadId: v.id('projectArtifactUploads'),
		key: v.string(),
		url: v.string(),
	}),
	handler: async (ctx, args) => {
		const { project, user } = await assertCanManageProject(
			ctx,
			args.projectId,
			'You must be logged in to upload version files',
		)
		assertValidVersionString(args.version)
		const validationError = validateProjectArtifactFile({
			type: project.type,
			fileName: args.fileName,
			fileSize: args.fileSize,
		})
		if (validationError) throw new Error(validationError)

		const existing = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', args.projectId).eq('version', args.version),
			)
			.first()
		if (existing) throw new Error(`Version ${args.version} already exists`)

		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		assertPrivateUploadBucketConfigured()

		const artifactId = crypto.randomUUID()
		const releaseId = crypto.randomUUID()
		const key = buildProjectUploadR2ObjectKey({
			projectId: args.projectId,
			releaseId,
			artifactId,
			fileName: args.fileName,
		})
		const now = Date.now()
		const uploadId = await ctx.db.insert('projectArtifactUploads', {
			projectId: args.projectId,
			userId: user._id,
			projectType: project.type,
			version: args.version,
			artifactId,
			r2Key: key,
			fileName: args.fileName,
			declaredFileSize: args.fileSize,
			maxFileSize: getProjectArtifactPolicy(project.type).maxFileSize,
			status: 'pending',
			createdAt: now,
			expiresAt: now + ARTIFACT_UPLOAD_EXPIRES_IN_MS,
		})

		const upload = await uploadsR2.generateUploadUrl(key)
		return { uploadId, ...upload }
	},
})

export const create = mutation({
	args: {
		projectId: v.id('projects'),
		version: v.string(),
		changelog: v.optional(v.string()),
		uploadId: v.id('projectArtifactUploads'),
		gameVersions: v.optional(v.array(v.string())),
		skinModel: v.optional(skinModel),
	},
	handler: async (ctx, args) => {
		const { project, user } = await assertCanManageProject(
			ctx,
			args.projectId,
			'You must be logged in to publish versions',
		)
		assertValidVersionString(args.version)

		const existing = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', args.projectId).eq('version', args.version),
			)
			.first()

		if (existing) {
			throw new Error(`Version ${args.version} already exists`)
		}

		const upload = await ctx.db.get(args.uploadId)
		if (
			!upload ||
			upload.status !== 'pending' ||
			upload.projectId !== args.projectId ||
			upload.userId !== user._id ||
			upload.version !== args.version
		) {
			throw new Error('The artifact upload is invalid or has expired')
		}
		if (upload.expiresAt < Date.now()) {
			throw new Error('The artifact upload has expired. Upload it again.')
		}
		if (
			normalizeProjectType(upload.projectType) !==
			normalizeProjectType(project.type)
		) {
			throw new Error('The project type changed after this artifact was uploaded')
		}

		const policy = getProjectArtifactPolicy(project.type)
		if (policy.requireSkinModel && !args.skinModel) {
			throw new Error('Choose whether this skin uses the Classic or Slim model')
		}
		if (!policy.requireSkinModel && args.skinModel) {
			throw new Error('Skin model metadata is only valid for skin projects')
		}

		const metadata = await uploadsR2.getMetadata(ctx, upload.r2Key)
		const fileSize = metadata?.size
		if (!metadata || fileSize === undefined) {
			throw new Error('The uploaded artifact could not be found in storage')
		}
		const validationError = validateProjectArtifactFile({
			type: project.type,
			fileName: upload.fileName,
			fileSize,
		})
		if (validationError || fileSize !== upload.declaredFileSize) {
			const error = validationError ?? 'The uploaded file size does not match the reserved artifact'
			await ctx.db.patch(upload._id, { status: 'rejected', error })
			await uploadsR2.deleteObject(ctx, upload.r2Key)
			return { ok: false as const, error }
		}

		const now = Date.now()

		const versionId = await ctx.db.insert('projectVersions', {
			projectId: args.projectId,
			version: args.version,
			changelog: args.changelog,
			r2Key: upload.r2Key,
			uploadR2Key: upload.r2Key,
			fileName: upload.fileName,
			fileSize,
			artifactId: upload.artifactId,
			skinModel: args.skinModel,
			gameVersions: args.gameVersions,
			downloads: 0,
			validationStatus: 'pending',
			validationAttempts: 0,
			createdAt: now,
		})
		await ctx.db.patch(upload._id, { status: 'consumed' })

		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.collect()

		await ctx.db.patch(args.projectId, {
			versionCount: versions.filter(isValidatedVersion).length,
			updatedAt: now,
		})
		await ctx.scheduler.runAfter(
			0,
			internal.functions.projects.artifactValidation.validateVersion,
			{ versionId },
		)

		return { ok: true as const, versionId }
	},
})

export const discardUpload = mutation({
	args: { uploadId: v.id('projectArtifactUploads') },
	handler: async (ctx, args) => {
		const upload = await ctx.db.get(args.uploadId)
		if (!upload || upload.status !== 'pending') return

		const { user } = await assertCanManageProject(
			ctx,
			upload.projectId,
			'You must be logged in to discard artifact uploads',
		)
		if (upload.userId !== user._id && user.role !== 'admin') {
			throw new Error('You cannot discard this artifact upload')
		}

		await uploadsR2.deleteObject(ctx, upload.r2Key)
		await ctx.db.delete(upload._id)
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
		if (!isValidatedVersion(version)) {
			return {
				ok: false as const,
				code: 'VERSION_NOT_VALIDATED' as const,
				message: 'This release is still being validated.',
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

		const artifactKey = getPublishedArtifactKey(version)
		if (!artifactKey) {
			return {
				ok: false as const,
				code: 'VERSION_PROCESSING' as const,
				message: 'This release is being prepared for CDN delivery.',
			}
		}

		const metadata = await cdnR2.getMetadata(ctx, artifactKey)
		if (!metadata) {
			return {
				ok: false as const,
				code: 'FILE_MISSING' as const,
				message:
					'The release file is temporarily unavailable. The creator may need to upload it again.',
			}
		}

		const url = await resolveCdnObjectUrl(
			artifactKey,
			VERSION_DOWNLOAD_URL_EXPIRES_IN,
		)

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

export const retryValidation = mutation({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version) throw new Error('Version not found')
		await assertCanManageProject(
			ctx,
			version.projectId,
			'You must be logged in to retry artifact validation',
		)
		if (version.validationCode !== 'VALIDATOR_UNAVAILABLE') {
			throw new Error('Upload a replacement for this rejected artifact')
		}
		const sourceKey = version.uploadR2Key ?? version.r2Key
		const metadata = version.uploadR2Key
			? await uploadsR2.getMetadata(ctx, sourceKey)
			: await cdnR2.getMetadata(ctx, sourceKey)
		if (!metadata) throw new Error('The artifact file is no longer in storage')
		await ctx.db.patch(version._id, {
			validationStatus: 'pending',
			validationCode: undefined,
			validationError: undefined,
		})
		await ctx.scheduler.runAfter(
			0,
			internal.functions.projects.artifactValidation.validateVersion,
			{ versionId: version._id },
		)
	},
})

export const prepareVersionRemoval = internalMutation({
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
		await ctx.db.patch(version._id, { deletionRequestedAt: Date.now() })
		return version
	},
})

export const finalizeVersionRemoval = internalMutation({
	args: {
		id: v.id('projectVersions'),
		uploadKeys: v.array(v.string()),
		cdnKeys: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.id)
		if (!version) return
		await assertCanManageProject(
			ctx,
			version.projectId,
			'You must be logged in to delete versions',
		)
		if (!version.deletionRequestedAt) {
			throw new Error('Version deletion was not prepared')
		}

		for (const key of new Set(args.uploadKeys)) {
			await uploadsR2.deleteObject(ctx, key)
		}
		for (const key of new Set(args.cdnKeys)) {
			await cdnR2.deleteObject(ctx, key)
		}

		const uploadReservations = await ctx.db
			.query('projectArtifactUploads')
			.withIndex('by_project', (q) => q.eq('projectId', version.projectId))
			.collect()
		for (const upload of uploadReservations) {
			if (
				upload.artifactId === version.artifactId ||
				args.uploadKeys.includes(upload.r2Key)
			) {
				await ctx.db.delete(upload._id)
			}
		}

		await ctx.db.delete(args.id)
		await updateProjectDownloadStats(ctx, version.projectId)

		const allVersions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', version.projectId))
			.order('desc')
			.collect()
		const versions = allVersions.filter(isValidatedVersion)
		const latestVersion = versions[0]

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
