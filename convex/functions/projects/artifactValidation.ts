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
import { wakeAnnouncement } from '../../lib/discordAnnouncements'
import {
	saveVersionFiles,
	storedValidationReport,
	type ValidatorReport,
} from '../../lib/projectVersionFiles'
import {
	releaseFile,
	releaseFinding,
	releaseScriptModule,
} from '../../schemas/projects'

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
	sha256: v.optional(v.string()),
	checksVersion: v.optional(v.number()),
	fileCount: v.optional(v.number()),
	scriptModules: v.optional(v.array(releaseScriptModule)),
	findings: v.optional(v.array(releaseFinding)),
})

interface ValidatorResult {
	valid: boolean
	code?: string
	error?: string
	report?: ValidatorReport
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
	const versions = allVersions.filter(isPublicRelease)
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
		files: v.optional(
			v.object({ files: v.array(releaseFile), truncated: v.boolean() }),
		),
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
		await saveVersionFiles(ctx, version._id, args.files)
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
		if (
			!version ||
			version.validationStatus !== 'valid' ||
			!isApprovedRelease(version) ||
			version.deletionRequestedAt
		) return null
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
		if (version.validationStatus !== 'valid') {
			await cdnR2.deleteObject(ctx, args.cdnKey)
			return
		}
		await ctx.db.patch(version._id, {
			r2Key: args.cdnKey,
			uploadR2Key: args.uploadKey,
			cdnR2Key: args.cdnKey,
			publishedAt: version.publishedAt ?? Date.now(),
		})
		await uploadsR2.deleteObject(ctx, args.uploadKey)
		await wakeAnnouncement(ctx, 'project', version.projectId)
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

const CHECKSUM_BATCH_SIZE = 10

export const listVersionsForChecksums = internalQuery({
	args: { cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('projectVersions')
			.paginate({ cursor: args.cursor, numItems: CHECKSUM_BATCH_SIZE })
		const versions = await Promise.all(
			result.page
				.filter(
					(version) =>
						version.validationStatus === 'valid' &&
						!version.validationReport?.sha256 &&
						!version.deletionRequestedAt,
				)
				.map(async (version) => {
					const project = await ctx.db.get(version.projectId)
					return project ? { project, version } : null
				}),
		)
		return {
			continueCursor: result.continueCursor,
			isDone: result.isDone,
			versions: versions.flatMap((item) => (item ? [item] : [])),
		}
	},
})

export const saveChecksum = internalMutation({
	args: { versionId: v.id('projectVersions'), sha256: v.string() },
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (version?.validationReport) {
			await ctx.db.patch(version._id, {
				validationReport: { ...version.validationReport, sha256: args.sha256 },
			})
		}
	},
})

/**
 * Adds checksums to releases validated before they were recorded, by sending
 * each through the validator again. Results other than a checksum change
 * nothing, so a release that now fails stays as it was and is only logged.
 * Safe to re-run: releases with a checksum are skipped.
 *
 * Run: npx convex run functions/projects/artifactValidation:backfillChecksums
 */
export const backfillChecksums = internalAction({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	handler: async (ctx, args): Promise<void> => {
		const page: {
			continueCursor: string
			isDone: boolean
			versions: Array<{
				project: Doc<'projects'>
				version: Doc<'projectVersions'>
			}>
		} = await ctx.runQuery(
			internal.functions.projects.artifactValidation.listVersionsForChecksums,
			{ cursor: args.cursor ?? null },
		)
		const config = page.versions.length > 0 ? getValidatorConfig() : null

		for (const { project, version } of page.versions) {
			if (!config) break
			// A promoted release's upload copy is gone; the CDN holds the file.
			const downloadUrl = version.cdnR2Key
				? await cdnR2.getUrl(version.cdnR2Key, {
						expiresIn: VALIDATION_URL_EXPIRES_IN,
					})
				: version.uploadR2Key
					? await uploadsR2.getUrl(version.uploadR2Key, {
							expiresIn: VALIDATION_URL_EXPIRES_IN,
						})
					: await cdnR2.getUrl(version.r2Key, {
							expiresIn: VALIDATION_URL_EXPIRES_IN,
						})
			const response = await fetch(config.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': config.apiKey,
				},
				body: JSON.stringify({
					type: normalizeProjectType(project.type),
					fileName: version.fileName,
					fileSize: version.fileSize,
					downloadUrl,
				}),
				signal: AbortSignal.timeout(120_000),
			}).catch(() => null)
			const result = response?.ok
				? ((await response.json()) as ValidatorResult)
				: null
			if (result?.valid && result.report?.sha256) {
				await ctx.runMutation(
					internal.functions.projects.artifactValidation.saveChecksum,
					{ versionId: version._id, sha256: result.report.sha256 },
				)
			} else {
				console.error(`[Checksums] No checksum for release ${version._id}`)
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.projects.artifactValidation.backfillChecksums,
				{ cursor: page.continueCursor },
			)
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
				const { report, files } = storedValidationReport(result.report)
				await ctx.runMutation(
					internal.functions.projects.artifactValidation.applyValidationResult,
					{
						versionId: args.versionId,
						status: 'valid',
						report,
						files,
						deleteArtifact: false,
					},
				)
				if (data.project.status === 'published') {
					await ctx.runAction(
						internal.functions.projects.artifactDelivery.promoteVersion,
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
