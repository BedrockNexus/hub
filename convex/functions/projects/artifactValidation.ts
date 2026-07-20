import { CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
} from '../../_generated/server'
import {
	cdnR2,
	r2S3,
	syncCdnObjectMetadata,
	syncUploadObjectMetadata,
	uploadsR2,
} from '../../lib/r2'
import { buildProjectDownloadR2ObjectKey } from '../../lib/r2Keys'
import { normalizeProjectType } from '../../../lib/project-artifacts'

const VALIDATION_URL_EXPIRES_IN = 60 * 15
const MAX_VALIDATION_ATTEMPTS = 3

const validationReport = v.object({
	type: v.string(),
	fileSize: v.number(),
	entryCount: v.optional(v.number()),
	totalUncompressedSize: v.optional(v.number()),
	manifestCount: v.optional(v.number()),
	width: v.optional(v.number()),
	height: v.optional(v.number()),
})

interface ValidatorResult {
	valid: boolean
	code?: string
	error?: string
	report?: {
		type: string
		fileSize: number
		entryCount?: number
		totalUncompressedSize?: number
		manifestCount?: number
		width?: number
		height?: number
	}
}

function getValidatorConfig() {
	const rawUrl = process.env.ARTIFACT_VALIDATOR_URL
	const apiKey =
		process.env.ARTIFACT_VALIDATOR_API_KEY ??
		process.env.BEDROCKNEXUS_API_KEY
	if (!rawUrl || !apiKey) {
		throw new Error('Artifact validator is not configured')
	}
	const url = new URL(rawUrl)
	if (
		url.protocol !== 'https:' ||
		['localhost', '127.0.0.1', '::1'].includes(url.hostname)
	) {
		throw new Error('ARTIFACT_VALIDATOR_URL must be a public HTTPS URL')
	}
	return { apiKey, url: new URL('/artifact-validate', url).toString() }
}

export const getVersionForValidation = internalQuery({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version) return null
		const project = await ctx.db.get(version.projectId)
		return project ? { project, version } : null
	},
})

export const markValidating = internalMutation({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version || version.validationStatus === 'valid') return null
		const attempts = (version.validationAttempts ?? 0) + 1
		await ctx.db.patch(version._id, {
			validationStatus: 'validating',
			validationAttempts: attempts,
			validationCode: undefined,
			validationError: undefined,
		})
		return attempts
	},
})

async function updateProjectReleaseSummary(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
) {
	const allVersions = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.order('desc')
		.collect()
	const versions = allVersions.filter(
		(version) =>
			version.validationStatus === undefined ||
			version.validationStatus === 'valid',
	)
	const latest = versions[0]
	await ctx.db.patch(projectId, {
		latestVersionId: latest?._id,
		latestVersionString: latest?.version,
		latestVersionAt: latest?.createdAt,
		versionCount: versions.length,
		updatedAt: Date.now(),
	})
}

export const applyValidationResult = internalMutation({
	args: {
		versionId: v.id('projectVersions'),
		status: v.union(v.literal('valid'), v.literal('invalid')),
		code: v.optional(v.string()),
		error: v.optional(v.string()),
		report: v.optional(validationReport),
		deleteArtifact: v.boolean(),
	},
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version) return
		await ctx.db.patch(version._id, {
			validationStatus: args.status,
			validationCode: args.code,
			validationError: args.error,
			validationReport: args.report,
			validatedAt: Date.now(),
		})
		if (args.deleteArtifact) {
			if (version.uploadR2Key) {
				await uploadsR2.deleteObject(ctx, version.uploadR2Key)
			} else {
				await cdnR2.deleteObject(ctx, version.r2Key)
			}
		}
		await updateProjectReleaseSummary(ctx, version.projectId)
	},
})

export const getVersionForPromotion = internalQuery({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version || version.validationStatus !== 'valid') return null
		const project = await ctx.db.get(version.projectId)
		if (
			!project ||
			project.status !== 'published' ||
			project.moderationStatus !== 'approved'
		) return null
		if (version.cdnR2Key) return null
		return { project, version }
	},
})

export const listProjectVersionsForDelivery = internalQuery({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		return ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
			.collect()
	},
})

export const finalizePromotion = internalMutation({
	args: {
		versionId: v.id('projectVersions'),
		uploadKey: v.string(),
		cdnKey: v.string(),
	},
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version || version.validationStatus !== 'valid') return
		await ctx.db.patch(version._id, {
			r2Key: args.cdnKey,
			uploadR2Key: args.uploadKey,
			cdnR2Key: args.cdnKey,
			publishedAt: version.publishedAt ?? Date.now(),
		})
		await uploadsR2.deleteObject(ctx, args.uploadKey)
	},
})

export const finalizeDemotion = internalMutation({
	args: {
		versionId: v.id('projectVersions'),
		uploadKey: v.string(),
		cdnKey: v.string(),
	},
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version || version.cdnR2Key !== args.cdnKey) return
		await ctx.db.patch(version._id, {
			r2Key: args.uploadKey,
			uploadR2Key: args.uploadKey,
			cdnR2Key: undefined,
			publishedAt: undefined,
		})
		await cdnR2.deleteObject(ctx, args.cdnKey)
	},
})

function copySource(bucket: string, key: string) {
	const encodedKey = key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')
	return `${bucket}/${encodedKey}`
}

function attachmentDisposition(fileName: string) {
	const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download'
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export const promoteVersion = internalAction({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const data = (await ctx.runQuery(
			internal.functions.projects.artifactValidation.getVersionForPromotion,
			args,
		)) as { project: Doc<'projects'>; version: Doc<'projectVersions'> } | null
		if (!data) return

		const uploadKey = data.version.uploadR2Key ?? data.version.r2Key
		let metadata
		try {
			metadata = await r2S3.send(
				new HeadObjectCommand({
					Bucket: uploadsR2.config.bucket,
					Key: uploadKey,
				}),
			)
		} catch {
			throw new Error('Validated release is missing from private storage')
		}
		const cdnKey = buildProjectDownloadR2ObjectKey({
			projectId: data.project._id,
			releaseId: data.version._id,
			version: data.version.version,
			artifactId: data.version.artifactId ?? data.version._id,
			fileName: data.version.fileName,
		})

		await r2S3.send(
			new CopyObjectCommand({
				Bucket: cdnR2.config.bucket,
				Key: cdnKey,
				CopySource: copySource(uploadsR2.config.bucket, uploadKey),
				MetadataDirective: 'REPLACE',
				ContentType: metadata.ContentType ?? 'application/octet-stream',
				ContentDisposition: attachmentDisposition(data.version.fileName),
				CacheControl: 'public, max-age=31536000, immutable',
			}),
		)
		await syncCdnObjectMetadata(ctx, cdnKey)
		await ctx.runMutation(
			internal.functions.projects.artifactValidation.finalizePromotion,
			{ versionId: data.version._id, uploadKey, cdnKey },
		)
	},
})

export const demoteVersion = internalAction({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const data = (await ctx.runQuery(
			internal.functions.projects.artifactValidation.getVersionForValidation,
			args,
		)) as { project: Doc<'projects'>; version: Doc<'projectVersions'> } | null
		if (
			!data?.version.cdnR2Key ||
			(data.project.status === 'published' &&
				data.project.moderationStatus === 'approved')
		) return
		const uploadKey = data.version.uploadR2Key
		if (!uploadKey) return

		let metadata
		try {
			metadata = await r2S3.send(
				new HeadObjectCommand({
					Bucket: cdnR2.config.bucket,
					Key: data.version.cdnR2Key,
				}),
			)
		} catch {
			return
		}
		await r2S3.send(
			new CopyObjectCommand({
				Bucket: uploadsR2.config.bucket,
				Key: uploadKey,
				CopySource: copySource(cdnR2.config.bucket, data.version.cdnR2Key),
				MetadataDirective: 'REPLACE',
				ContentType: metadata.ContentType ?? 'application/octet-stream',
			}),
		)
		await syncUploadObjectMetadata(ctx, uploadKey)
		await ctx.runMutation(
			internal.functions.projects.artifactValidation.finalizeDemotion,
			{
				versionId: data.version._id,
				uploadKey,
				cdnKey: data.version.cdnR2Key,
			},
		)
	},
})

export const syncProjectDelivery = internalAction({
	args: { projectId: v.id('projects'), published: v.boolean() },
	handler: async (ctx, args) => {
		const versions = (await ctx.runQuery(
			internal.functions.projects.artifactValidation.listProjectVersionsForDelivery,
			{ projectId: args.projectId },
		)) as Doc<'projectVersions'>[]
		for (const version of versions) {
			if (args.published) {
				await ctx.runAction(
					internal.functions.projects.artifactValidation.promoteVersion,
					{ versionId: version._id },
				)
			} else if (version.cdnR2Key) {
				await ctx.runAction(
					internal.functions.projects.artifactValidation.demoteVersion,
					{ versionId: version._id },
				)
			}
		}
	},
})

export const validateVersion = internalAction({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const attempts = await ctx.runMutation(
			internal.functions.projects.artifactValidation.markValidating,
			args,
		)
		if (attempts === null) return

		const data = (await ctx.runQuery(
			internal.functions.projects.artifactValidation.getVersionForValidation,
			args,
		)) as { project: Doc<'projects'>; version: Doc<'projectVersions'> } | null
		if (!data) return

		try {
			const config = getValidatorConfig()
			const sourceKey = data.version.uploadR2Key ?? data.version.r2Key
			const source = data.version.uploadR2Key ? uploadsR2 : cdnR2
			const downloadUrl = await source.getUrl(sourceKey, {
				expiresIn: VALIDATION_URL_EXPIRES_IN,
			})
			const response = await fetch(config.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': config.apiKey,
				},
				body: JSON.stringify({
					type: normalizeProjectType(data.project.type),
					fileName: data.version.fileName,
					fileSize: data.version.fileSize,
					downloadUrl,
				}),
				signal: AbortSignal.timeout(120_000),
			})
			if (!response.ok) {
				throw new Error(`Validator returned HTTP ${response.status}`)
			}
			const result = (await response.json()) as ValidatorResult
			if (result.valid && result.report) {
				await ctx.runMutation(
					internal.functions.projects.artifactValidation.applyValidationResult,
					{
						versionId: args.versionId,
						status: 'valid',
						report: result.report,
						deleteArtifact: false,
					},
				)
				if (data.project.status === 'published') {
					await ctx.runAction(
						internal.functions.projects.artifactValidation.promoteVersion,
						args,
					)
				}
				return
			}
			await ctx.runMutation(
				internal.functions.projects.artifactValidation.applyValidationResult,
				{
					versionId: args.versionId,
					status: 'invalid',
					code: result.code ?? 'INVALID_ARTIFACT',
					error: result.error ?? 'The artifact failed validation',
					deleteArtifact: true,
				},
			)
		} catch (error) {
			if (attempts < MAX_VALIDATION_ATTEMPTS) {
				await ctx.scheduler.runAfter(
					30_000 * attempts,
					internal.functions.projects.artifactValidation.validateVersion,
					args,
				)
				return
			}
			await ctx.runMutation(
				internal.functions.projects.artifactValidation.applyValidationResult,
				{
					versionId: args.versionId,
					status: 'invalid',
					code: 'VALIDATOR_UNAVAILABLE',
					error:
						error instanceof Error
							? error.message
							: 'Artifact validation is temporarily unavailable',
					deleteArtifact: false,
				},
			)
		}
	},
})
