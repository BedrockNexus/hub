import { ConvexError, v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import {
	internalMutation,
	mutation,
	query,
} from '../../_generated/server'
import { authComponent } from '../../auth'
import {
	canEditContent,
	isAffiliatedWithContent,
} from '../../lib/permissions'
import { isPublicProject } from '../../lib/contentVisibility'
import {
	getPublishedReleaseKey,
	isApprovedRelease,
	isPublicRelease,
	isValidatedRelease,
} from '../../lib/projectReleases'
import {
	assertPrivateUploadBucketConfigured,
	cdnR2,
	resolveCdnObjectUrl,
	uploadsR2,
} from '../../lib/r2'
import { buildProjectUploadR2ObjectKey } from '../../lib/r2Keys'
import { updateProjectReleaseSummary } from './artifactValidation'
import { recordEditorMediaReferences } from '../../lib/editorMedia'
import { appRateLimiter, enforceRateLimit } from '../../lib/rateLimits'
import {
	getProjectArtifactPolicy,
	getProjectReleasePolicy,
	isSupportedProjectType,
	normalizeProjectType,
	validateProjectArtifactFile,
} from '../../../lib/project-artifacts'
import { recordReleaseActivity } from '../../lib/activity'

const VERSION_DOWNLOAD_URL_EXPIRES_IN = 60 * 5
const ARTIFACT_UPLOAD_EXPIRES_IN_MS = 1000 * 60 * 60 * 24

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

function toPublicRelease(version: Doc<'projectVersions'>) {
	return {
		_id: version._id,
		version: version.version,
		changelog: version.changelog,
		fileName: version.fileName,
		fileSize: version.fileSize,
		gameVersions: version.gameVersions,
		downloads: version.downloads,
		createdAt: version.createdAt,
		downloadUrl: `/api/projects/versions/${version._id}/download`,
	}
}

function toCreatorRelease(version: Doc<'projectVersions'>) {
	return {
		_id: version._id,
		version: version.version,
		changelog: version.changelog,
		fileName: version.fileName,
		fileSize: version.fileSize,
		gameVersions: version.gameVersions,
		downloads: version.downloads,
		createdAt: version.createdAt,
		validationStatus: version.validationStatus,
		validationCode: version.validationCode,
		validationError: version.validationError,
		reviewStatus: version.reviewStatus,
		reviewReason: version.reviewReason,
		downloadUrl: isValidatedRelease(version)
			? `/api/projects/versions/${version._id}/download`
			: undefined,
	}
}

async function canModifyProject(
	ctx: MutationCtx | QueryCtx,
	project: { ownerType: 'user' | 'organization'; ownerId: string },
	userId: string,
) {
	return canEditContent(ctx, project, { _id: userId }, { allowSiteAdmin: false })
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
		await assertCanManageProject(
			ctx,
			args.projectId,
			'You must be logged in to view project releases',
		)
		const versions = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.order('desc')
			.collect()

		return versions.map(toCreatorRelease)
	},
})

export const listPublic = query({
	args: {
		projectId: v.id('projects'),
	},
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (
			!project ||
			!isSupportedProjectType(project.type) ||
			!isPublicProject(project)
		) {
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
					isPublicRelease(version) &&
					Boolean(getPublishedReleaseKey(version)),
			)
			.map(toPublicRelease)
	},
})

export const getPublicByVersion = query({
	args: { slug: v.string(), version: v.string() },
	handler: async (ctx, args) => {
		const project = await ctx.db
			.query('projects')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique()
		if (
			!project ||
			!isSupportedProjectType(project.type) ||
			!isPublicProject(project)
		) return null
		const version = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', project._id).eq('version', args.version),
			)
			.unique()
		if (
			!version ||
			!isPublicRelease(version) ||
			!getPublishedReleaseKey(version)
		) return null
		return {
			...toPublicRelease(version),
			project: {
				name: project.name,
				slug: project.slug,
				type: project.type,
			},
		}
	},
})

export const getLatest = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		if (
			!project ||
			!isSupportedProjectType(project.type) ||
			!isPublicProject(project)
		) return null

		// Newer releases may still be validating or awaiting review.
		const recent = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.order('desc')
			.take(50)
		const version = recent.find(
			(release) =>
				isPublicRelease(release) && Boolean(getPublishedReleaseKey(release)),
		)

		return version ? toPublicRelease(version) : null
	},
})

export const getByVersion = query({
	args: {
		projectId: v.id('projects'),
		version: v.string(),
	},
	handler: async (ctx, args) => {
		if (!args.version) {
			return null
		}
		const project = await ctx.db.get(args.projectId)
		if (
			!project ||
			!isSupportedProjectType(project.type) ||
			!isPublicProject(project)
		) return null

		const requestedVersion = args.version
		const version = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', args.projectId).eq('version', requestedVersion),
			)
			.first()

		return version &&
			isPublicRelease(version) &&
			getPublishedReleaseKey(version)
			? toPublicRelease(version)
			: null
	},
})

/**
 * Releases of public projects waiting for a moderator. Releases of projects
 * still in their first review are approved with the project instead.
 */
export const listPendingReleases = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (user?.role !== 'admin') {
			throw new ConvexError('Admin role required')
		}
		const pending = await ctx.db
			.query('projectVersions')
			.withIndex('by_review_status', (q) => q.eq('reviewStatus', 'pending'))
			.take(100)

		const result = []
		for (const version of pending) {
			const project = await ctx.db.get(version.projectId)
			if (!project || !isPublicProject(project)) continue
			result.push({
				...toCreatorRelease(version),
				project: {
					_id: project._id,
					name: project.name,
					slug: project.slug,
				},
			})
		}
		return result
	},
})

/**
 * Approves or rejects one release. Approval makes a validated release
 * downloadable on a public project; rejection is final for that release.
 * Admins cannot review releases of projects they own or belong to.
 */
export const reviewRelease = mutation({
	args: {
		versionId: v.id('projectVersions'),
		decision: v.union(v.literal('approved'), v.literal('rejected')),
		reason: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (user?.role !== 'admin') {
			throw new ConvexError('Admin role required')
		}
		const version = await ctx.db.get(args.versionId)
		if (!version) {
			throw new ConvexError('Release not found')
		}
		const project = await ctx.db.get(version.projectId)
		if (!project) {
			throw new ConvexError('Project not found')
		}
		if (await isAffiliatedWithContent(ctx, project, user._id)) {
			throw new ConvexError(
				'You cannot review releases of your own project. Ask another admin.',
			)
		}
		if (version.reviewStatus !== 'pending') {
			throw new ConvexError('This release is not waiting for review')
		}
		const reason = args.reason?.trim()
		if (args.decision === 'rejected' && !reason) {
			throw new ConvexError('A reason is required to reject a release')
		}
		if (args.decision === 'approved' && version.validationStatus !== 'valid') {
			throw new ConvexError('Only validated releases can be approved')
		}

		await ctx.db.patch(version._id, {
			reviewStatus: args.decision,
			reviewReason: args.decision === 'rejected' ? reason : undefined,
			reviewedAt: Date.now(),
			reviewedBy: user._id,
		})
		await updateProjectReleaseSummary(ctx, project._id)

		if (args.decision === 'approved') {
			await recordReleaseActivity(ctx, project, version)
			await ctx.scheduler.runAfter(
				0,
				internal.functions.projects.artifactDelivery.promoteVersion,
				{ versionId: version._id },
			)
		} else if (version.cdnR2Key) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.projects.artifactDelivery.demoteVersion,
				{ versionId: version._id },
			)
		}
		return version._id
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
		version: v.string(),
	}),
	handler: async (ctx, args) => {
		const { project, user } = await assertCanManageProject(
			ctx,
			args.projectId,
			'You must be logged in to upload version files',
		)
		const version = args.version.trim()
		if (!version) {
			throw new Error('Enter a release version before uploading')
		}
		assertValidVersionString(version)
		const validationError = validateProjectArtifactFile({
			type: project.type,
			fileName: args.fileName,
			fileSize: args.fileSize,
		})
		if (validationError) throw new Error(validationError)

		const existing = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', args.projectId).eq('version', version),
			)
			.first()
		if (existing) throw new Error(`Release ${version} already exists`)

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
			version,
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
		return { uploadId, version, ...upload }
	},
})

export const create = mutation({
	args: {
		projectId: v.id('projects'),
		version: v.string(),
		changelog: v.optional(v.string()),
		uploadId: v.id('projectArtifactUploads'),
		gameVersions: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const { project, user } = await assertCanManageProject(
			ctx,
			args.projectId,
			'You must be logged in to publish releases',
		)

		const upload = await ctx.db.get(args.uploadId)
		if (
			!upload ||
			upload.status !== 'pending' ||
			upload.projectId !== args.projectId ||
			upload.userId !== user._id
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
		const releasePolicy = getProjectReleasePolicy(project.type)
		const version = upload.version
		assertValidVersionString(version)
		if (
			releasePolicy.requireCreatorVersion &&
			args.version?.trim() !== version
		) {
			throw new Error('The release version changed after the artifact was uploaded')
		}

		const existing = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_version', (q) =>
				q.eq('projectId', args.projectId).eq('version', version),
			)
			.first()
		if (existing) {
			throw new Error(`Release ${version} already exists`)
		}

		const gameVersions = Array.from(
			new Set(args.gameVersions?.map((value) => value.trim()).filter(Boolean)),
		)
		if (releasePolicy.requireGameVersions && gameVersions.length === 0) {
			throw new Error('Select at least one supported Minecraft version')
		}
		const changelog = args.changelog?.trim()

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
			version,
			changelog: releasePolicy.allowChangelog ? changelog : undefined,
			r2Key: upload.r2Key,
			uploadR2Key: upload.r2Key,
			fileName: upload.fileName,
			fileSize,
			artifactId: upload.artifactId,
			gameVersions:
				gameVersions.length > 0 ? gameVersions : undefined,
			downloads: 0,
			validationStatus: 'pending',
			validationAttempts: 0,
			// Every release is reviewed. Releases of a project that is not yet
			// public are approved together with the project.
			reviewStatus: 'pending',
			createdAt: now,
		})
		await ctx.db.patch(upload._id, { status: 'consumed' })
		await recordEditorMediaReferences(
			ctx,
			'projectVersions',
			versionId,
			releasePolicy.allowChangelog ? changelog : undefined,
		)
		await updateProjectReleaseSummary(ctx, args.projectId)
		await ctx.scheduler.runAfter(
			0,
			internal.functions.projects.artifactValidation.validateVersion,
			{ versionId },
		)

		return { ok: true as const, version, versionId }
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

/**
 * Issues a short-lived download URL. Only the Next.js download route may call
 * this: it proves itself with DOWNLOAD_REDIRECT_SECRET and passes a salted
 * hash of the client address so anonymous downloads are limited per client
 * instead of sharing one bucket per release.
 */
export const createDownloadUrl = mutation({
	args: {
		versionId: v.id('projectVersions'),
		downloadSecret: v.string(),
		clientKey: v.string(),
	},
	handler: async (ctx, args) => {
		const expectedSecret = process.env.DOWNLOAD_REDIRECT_SECRET
		if (!expectedSecret || args.downloadSecret !== expectedSecret) {
			throw new ConvexError('Downloads must be requested through the download route')
		}
		if (!/^[a-f0-9]{64}$/.test(args.clientKey)) {
			throw new ConvexError('Invalid download client key')
		}

		const version = await ctx.db.get(args.versionId)
		if (!version) {
			return {
				ok: false as const,
				code: 'VERSION_NOT_FOUND' as const,
				message: 'This release is no longer available.',
			}
		}
		if (!isValidatedRelease(version)) {
			return {
				ok: false as const,
				code: 'VERSION_NOT_VALIDATED' as const,
				message: 'This release is still being validated.',
			}
		}
		if (!isApprovedRelease(version)) {
			return {
				ok: false as const,
				code: 'VERSION_UNAVAILABLE' as const,
				message: 'This release is not publicly available.',
			}
		}

		const project = await ctx.db.get(version.projectId)
		if (
			!project ||
			!isSupportedProjectType(project.type) ||
			!isPublicProject(project)
		) {
			return {
				ok: false as const,
				code: 'VERSION_UNAVAILABLE' as const,
				message: 'This release is not publicly available.',
			}
		}

		const user = await authComponent.safeGetAuthUser(ctx)
		const requesterKey = user?._id
			? `user:${user._id}`
			: `client:${args.clientKey}`
		await enforceRateLimit(
			ctx,
			'versionDownload',
			requesterKey,
			'Too many download requests. Please wait before trying again.',
		)

		const artifactKey = getPublishedReleaseKey(version)
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

		// Repeated downloads of the same release by the same requester within a
		// day still get a fresh link but are not counted again.
		const countResult = await appRateLimiter.limit(
			ctx,
			'versionDownloadCount',
			{ key: `${requesterKey}:${version._id}` },
		)
		if (countResult.ok) {
			await ctx.db.patch(args.versionId, {
				downloads: version.downloads + 1,
			})
			await updateProjectDownloadStats(ctx, version.projectId, {
				recordDownload: true,
			})
		}

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

		await updateProjectReleaseSummary(ctx, version.projectId)
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
