import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
} from '../../_generated/server'
import { r2 } from '../../lib/r2'
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
			await r2.deleteObject(ctx, version.r2Key)
		}
		await updateProjectReleaseSummary(ctx, version.projectId)
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
			const downloadUrl = await r2.getUrl(data.version.r2Key, {
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
