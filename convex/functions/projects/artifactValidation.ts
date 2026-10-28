import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
} from '../../_generated/server'
import { isApprovedRelease, isPublicRelease } from '../../lib/projectReleases'
import { syncProject } from '../../lib/discovery'
import { cdnR2, uploadsR2 } from '../../lib/r2'
import { normalizeProjectType } from '../../../lib/project-artifacts'
import { mapValidationReport } from '../../schemas/mapReleases'
import { mapValidationReportSchema } from '../../../lib/map-validation-report'
import {
	mapReleaseMetadataSchema,
	mapReleaseObservationIssues,
} from '../../../lib/map-release-metadata'
import { buildProjectUploadR2ObjectKey } from '../../lib/r2Keys'
import { readMapValidatorResult } from '../../../lib/map-validator-result'

const MAX_SUPPORTED_GAME_VERSIONS = 200

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
	returns: v.union(
		v.object({ attempts: v.number(), token: v.string() }),
		v.null(),
	),
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (
			!version ||
			version.validationStatus === 'valid' ||
			version.deletionRequestedAt
		)
			return null
		const attempts = (version.validationAttempts ?? 0) + 1
		const token = crypto.randomUUID()
		await ctx.db.patch(version._id, {
			validationStatus: 'validating',
			validationAttempts: attempts,
			validationToken: token,
			validationCode: undefined,
			validationError: undefined,
		})
		return { attempts, token }
	},
})

/** Recomputes the project's public release count and latest public release. */
/** Every Minecraft version covered by at least one of the given releases. */
export function supportedGameVersions(
	releases: ReadonlyArray<{ gameVersions?: string[] }>,
): string[] {
	return [
		...new Set(releases.flatMap((release) => release.gameVersions ?? [])),
	].slice(0, MAX_SUPPORTED_GAME_VERSIONS)
}

export async function updateProjectReleaseSummary(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
) {
	const allVersions = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.order('desc')
		.collect()
	const ownerProject = await ctx.db.get(projectId)
	const versions = allVersions.filter((release) =>
		isPublicRelease(release, ownerProject?.type),
	)
	const latest = versions[0]
	await ctx.db.patch(projectId, {
		latestVersionId: latest?._id,
		latestVersionString: latest?.version,
		latestVersionAt: latest?.createdAt,
		versionCount: versions.length,
		supportedGameVersions: supportedGameVersions(versions),
		updatedAt: Date.now(),
	})
	const project = await ctx.db.get(projectId)
	if (project) {
		await syncProject(ctx, project)
	}
}

export const applyValidationResult = internalMutation({
	args: {
		versionId: v.id('projectVersions'),
		status: v.union(v.literal('valid'), v.literal('invalid')),
		code: v.optional(v.string()),
		error: v.optional(v.string()),
		report: v.optional(validationReport),
		deleteArtifact: v.boolean(),
		token: v.optional(v.string()),
		mapReport: v.optional(mapValidationReport),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (
			!version ||
			version.deletionRequestedAt ||
			(args.token !== undefined &&
				(version.validationToken !== args.token ||
					version.validationStatus !== 'validating'))
		)
			return null
		const project = await ctx.db.get(version.projectId)
		if (project?.type === 'map') {
			if (!args.token || version.validationToken !== args.token)
				return null
			if (args.status === 'valid') {
				const metadata = mapReleaseMetadataSchema.parse(
					version.releaseMetadata,
				)
				const report = mapValidationReportSchema.parse(args.mapReport)
				if (
					!version.sealedR2Key ||
					report.sourceEtag !== version.sealedEtag ||
					report.fileSize !== version.fileSize
				)
					throw new Error('Maps artifact identity mismatch')
				if (mapReleaseObservationIssues(metadata, report).length)
					throw new Error('Maps artifact requirements mismatch')
			}
		}
		await ctx.db.patch(version._id, {
			validationStatus: args.status,
			validationCode: args.code,
			validationError: args.error,
			validationReport: args.report,
			mapValidationReport: args.mapReport,
			validatedAt: Date.now(),
		})
		if (args.deleteArtifact) {
			if (version.stagingR2Key)
				await uploadsR2.deleteObject(ctx, version.stagingR2Key)
			if (version.uploadR2Key) {
				await uploadsR2.deleteObject(ctx, version.uploadR2Key)
			} else {
				await cdnR2.deleteObject(ctx, version.r2Key)
			}
		}
		await updateProjectReleaseSummary(ctx, version.projectId)
		return null
	},
})

export const reserveSeal = internalMutation({
	args: { versionId: v.id('projectVersions'), token: v.string() },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		const release = await ctx.db.get(args.versionId)
		if (
			!release ||
			release.deletionRequestedAt ||
			release.validationToken !== args.token ||
			release.artifactType !== 'map'
		)
			return null
		const key = buildProjectUploadR2ObjectKey({
			projectId: release.projectId,
			releaseId: release._id,
			artifactId: `sealed-${args.token}`,
			fileName: release.fileName,
		})
		if (release.sealedR2Key === key) return null
		await ctx.db.patch(release._id, {
			sealedR2Key: key,
			sealedEtag: undefined,
			stagingR2Key: release.stagingR2Key ?? release.uploadR2Key,
		})
		return key
	},
})

export const recordSeal = internalMutation({
	args: {
		versionId: v.id('projectVersions'),
		token: v.string(),
		key: v.string(),
		etag: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get(args.versionId)
		if (
			!release ||
			release.deletionRequestedAt ||
			release.validationStatus !== 'validating' ||
			release.sealedEtag ||
			release.validationToken !== args.token ||
			release.sealedR2Key !== args.key
		)
			return false
		await ctx.db.patch(release._id, {
			sealedEtag: args.etag,
			uploadR2Key: args.key,
			r2Key: args.key,
		})
		return true
	},
})

export const getVersionForPromotion = internalQuery({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (
			!version ||
			version.validationStatus !== 'valid' ||
			!isApprovedRelease(version) ||
			version.deletionRequestedAt
		)
			return null
		const project = await ctx.db.get(version.projectId)
		if (
			!project ||
			project.status !== 'published' ||
			project.moderationStatus !== 'approved'
		)
			return null
		if (!isPublicRelease(version, project.type) || version.cdnR2Key)
			return null
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
		sourceEtag: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version) {
			await cdnR2.deleteObject(ctx, args.cdnKey)
			await uploadsR2.deleteObject(ctx, args.uploadKey)
			return
		}
		if (version.deletionRequestedAt) {
			await cdnR2.deleteObject(ctx, args.cdnKey)
			await uploadsR2.deleteObject(ctx, args.uploadKey)
			return
		}
		const project = await ctx.db.get(version.projectId)
		if (
			project?.type === 'map' &&
			(version.sealedEtag !== args.sourceEtag ||
				version.sealedR2Key !== args.uploadKey)
		) {
			if (version.cdnR2Key !== args.cdnKey)
				await cdnR2.deleteObject(ctx, args.cdnKey)
			return
		}
		if (
			!project ||
			version.validationStatus !== 'valid' ||
			project.status !== 'published' ||
			project.moderationStatus !== 'approved' ||
			!isPublicRelease(version, project.type)
		) {
			await cdnR2.deleteObject(ctx, args.cdnKey)
			return
		}
		await ctx.db.patch(version._id, {
			r2Key: args.cdnKey,
			uploadR2Key: args.uploadKey,
			cdnR2Key: args.cdnKey,
			publishedAt: version.publishedAt ?? Date.now(),
		})
		if (project.type !== 'map')
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
		const project = await ctx.db.get(version.projectId)
		if (
			project?.status === 'published' &&
			project.moderationStatus === 'approved' &&
			isPublicRelease(version, project.type)
		)
			return
		await ctx.db.patch(version._id, {
			r2Key: args.uploadKey,
			uploadR2Key: args.uploadKey,
			cdnR2Key: undefined,
			publishedAt: undefined,
		})
		await cdnR2.deleteObject(ctx, args.cdnKey)
	},
})

export const validateVersion = internalAction({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const attempt = await ctx.runMutation(
			internal.functions.projects.artifactValidation.markValidating,
			args,
		)
		if (attempt === null) return
		const { attempts, token } = attempt

		const data = (await ctx.runQuery(
			internal.functions.projects.artifactValidation
				.getVersionForValidation,
			args,
		)) as {
			project: Doc<'projects'>
			version: Doc<'projectVersions'>
		} | null
		if (!data) return

		try {
			const config = getValidatorConfig()
			const sealed =
				data.project.type === 'map'
					? await ctx.runAction(
							internal.functions.projects.artifactDelivery
								.sealVersion,
							{ versionId: args.versionId, token },
						)
					: null
			if (data.project.type === 'map' && !sealed) return
			const sourceKey =
				sealed?.key ?? data.version.uploadR2Key ?? data.version.r2Key
			const source = data.version.uploadR2Key ? uploadsR2 : cdnR2
			const downloadUrl = await source.getUrl(sourceKey, {
				expiresIn: VALIDATION_URL_EXPIRES_IN,
			})
			const response = await fetch(
				data.project.type === 'map' ? `${config.url}/maps` : config.url,
				{
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
						...(sealed ? { sourceEtag: sealed.etag } : {}),
					}),
					signal: AbortSignal.timeout(120_000),
				},
			)
			if (!response.ok) {
				throw new Error(`Validator returned HTTP ${response.status}`)
			}
			const result: ValidatorResult =
				data.project.type === 'map'
					? await readMapValidatorResult(response)
					: await response.json()
			if (data.project.type === 'map' && result.valid) {
				const report = mapValidationReportSchema.parse(result.report)
				const metadata = mapReleaseMetadataSchema.parse(
					data.version.releaseMetadata,
				)
				const issues = mapReleaseObservationIssues(metadata, report)
				if (issues.length) {
					await ctx.runMutation(
						internal.functions.projects.artifactValidation
							.applyValidationResult,
						{
							versionId: args.versionId,
							token,
							status: 'invalid',
							code: 'MAP_METADATA_MISMATCH',
							error: issues
								.map((issue) => issue.message)
								.join(' '),
							deleteArtifact: true,
						},
					)
					return
				}
				await ctx.runMutation(
					internal.functions.projects.artifactValidation
						.applyValidationResult,
					{
						versionId: args.versionId,
						token,
						status: 'valid',
						mapReport: report,
						deleteArtifact: false,
					},
				)
				return
			}
			if (result.valid && result.report) {
				await ctx.runMutation(
					internal.functions.projects.artifactValidation
						.applyValidationResult,
					{
						versionId: args.versionId,
						token,
						status: 'valid',
						report: result.report,
						deleteArtifact: false,
					},
				)
				if (data.project.status === 'published') {
					await ctx.runAction(
						internal.functions.projects.artifactDelivery
							.promoteVersion,
						args,
					)
				}
				return
			}
			await ctx.runMutation(
				internal.functions.projects.artifactValidation
					.applyValidationResult,
				{
					versionId: args.versionId,
					token,
					status: 'invalid',
					code: result.code ?? 'INVALID_ARTIFACT',
					error: result.error ?? 'The artifact failed validation',
					deleteArtifact: true,
				},
			)
		} catch (error) {
			const current = await ctx.runQuery(
				internal.functions.projects.artifactValidation
					.getVersionForValidation,
				args,
			)
			if (
				!current ||
				current.version.deletionRequestedAt ||
				current.version.validationToken !== token
			)
				return
			if (attempts < MAX_VALIDATION_ATTEMPTS) {
				await ctx.scheduler.runAfter(
					30_000 * attempts,
					internal.functions.projects.artifactValidation
						.validateVersion,
					args,
				)
				return
			}
			await ctx.runMutation(
				internal.functions.projects.artifactValidation
					.applyValidationResult,
				{
					versionId: args.versionId,
					token,
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
