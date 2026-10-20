'use node'

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import { ConvexError, v } from 'convex/values'

import {
	ArtifactError,
	extractPluginFile,
	MAX_PLUGIN_FILE_BYTES,
} from '../../../../lib/plugins/publishing/artifact'
import {
	DESCRIPTION_MAX_LENGTH,
	releaseTagFor,
	sanitizeReadmeExcerpt,
	slugifyProjectName,
} from '../../../../lib/plugins/publishing/metadata'
import {
	ARTIFACT_NAME,
	renderWorkflowTemplate,
	validateWorkflowTemplate,
	WORKFLOW_PATH,
} from '../../../../lib/plugins/workflow-templates'
import { internal } from '../../../_generated/api'
import type { Doc, Id } from '../../../_generated/dataModel'
import {
	type ActionCtx,
	action,
	internalAction,
} from '../../../_generated/server'
import { enforceRateLimit } from '../../../lib/plugins/rateLimits'
import { cdnR2, uploadsR2 } from '../../../lib/r2'
import {
	buildPluginDownloadR2ObjectKey,
	buildPluginReviewR2ObjectKey,
	sanitizeR2FileName,
} from '../../../lib/r2Keys'
import {
	createGitHubApp,
	requireGitHubAppConfig,
	throwGitHubApiError,
} from '../github/lib/app'

const WORKFLOW_FILE_NAME = WORKFLOW_PATH.split('/').pop() as string
const RUNS_PER_SYNC = 30
const REVIEW_LINK_SECONDS = 10 * 60

type PublishingActionContext = {
	draft: Doc<'pluginPublishingDrafts'>
	repository: Doc<'githubRepositories'>
	installationId: number
}

type ReleaseActionContext = {
	release: {
		_id: Id<'pluginReleases'>
		status: Doc<'pluginReleases'>['status']
		version: string
		changelog: string
		commitSha: string
		fileName?: string
		sha256?: string
		uploadKey?: string
		cdnKey?: string
		githubReleaseId?: number
	}
	projectId: Id<'plugins'>
	projectName: string
	projectSlug: string
	artifactId?: number
	artifactSize?: number
	fileExtension?: string
	repository: Doc<'githubRepositories'>
	installationId: number | null
}

const r2S3 = new S3Client({
	region: 'auto',
	endpoint: process.env.R2_ENDPOINT,
	credentials:
		process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
			? {
					accessKeyId: process.env.R2_ACCESS_KEY_ID,
					secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
				}
			: undefined,
})

function getConfig() {
	return requireGitHubAppConfig({
		appId: process.env.GITHUB_APP_ID,
		clientId: process.env.GITHUB_APP_CLIENT_ID,
		clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
		privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
		slug: process.env.GITHUB_APP_SLUG,
	})
}

async function installationOctokit(installationId: number) {
	return await createGitHubApp(getConfig()).getInstallationOctokit(
		installationId,
	)
}

type Octokit = Awaited<ReturnType<typeof installationOctokit>>

async function requireTokenIdentifier(ctx: ActionCtx) {
	const identity = await ctx.auth.getUserIdentity()
	if (!identity) {
		throw new ConvexError({
			code: 'UNAUTHENTICATED',
			message: 'Sign in is required.',
		})
	}
	return identity.tokenIdentifier
}

function isGitHubStatus(error: unknown, status: number) {
	return (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		Reflect.get(error, 'status') === status
	)
}

function parseTimestamp(value: string | null | undefined) {
	if (!value) {
		return undefined
	}
	const timestamp = Date.parse(value)
	return Number.isFinite(timestamp) ? timestamp : undefined
}

function errorText(error: unknown) {
	if (error instanceof ConvexError) {
		const data = error.data as { message?: unknown } | string
		return typeof data === 'string'
			? data
			: typeof data?.message === 'string'
				? data.message
				: 'Unexpected error.'
	}
	return error instanceof Error ? error.message : 'Unexpected error.'
}

async function blobShaAt(
	octokit: Octokit,
	repository: { ownerLogin: string; name: string },
	path: string,
	ref: string,
) {
	try {
		const file = await octokit.rest.repos.getContent({
			owner: repository.ownerLogin,
			repo: repository.name,
			path,
			ref,
		})
		return !Array.isArray(file.data) && file.data.type === 'file'
			? { sha: file.data.sha, content: file.data.content }
			: undefined
	} catch (error) {
		if (isGitHubStatus(error, 404)) {
			return undefined
		}
		throw error
	}
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Starts a plugin from a repository: the name is the repository name, the
 * summary its description, and the description its README. Nothing is
 * detected; the developer edits all of it next.
 */
export const startFromRepository = action({
	args: { repositoryId: v.id('githubRepositories') },
	returns: v.id('pluginPublishingDrafts'),
	handler: async (ctx, args): Promise<Id<'pluginPublishingDrafts'>> => {
		const tokenIdentifier = await requireTokenIdentifier(ctx)
		await enforceRateLimit(ctx, 'githubRead', tokenIdentifier)
		const access: {
			installationId: number
			ownerLogin: string
			name: string
		} = await ctx.runQuery(
			internal.functions.plugins.github.installations.getRepositoryAccess,
			{ tokenIdentifier, repositoryId: args.repositoryId },
		)
		const octokit = await installationOctokit(access.installationId)
		let repository: Awaited<ReturnType<Octokit['rest']['repos']['get']>>
		let readme = ''
		try {
			repository = await octokit.rest.repos.get({
				owner: access.ownerLogin,
				repo: access.name,
			})
			try {
				const response = await octokit.rest.repos.getReadme({
					owner: access.ownerLogin,
					repo: access.name,
				})
				readme = Buffer.from(response.data.content, 'base64').toString(
					'utf8',
				)
			} catch (error) {
				if (!isGitHubStatus(error, 404)) {
					throw error
				}
			}
		} catch (error) {
			throwGitHubApiError(error)
		}
		const name = repository.data.name
		const license =
			repository.data.license?.spdx_id &&
			repository.data.license.spdx_id !== 'NOASSERTION'
				? repository.data.license.spdx_id
				: undefined
		const summary = (
			repository.data.description?.trim() ||
			sanitizeReadmeExcerpt(readme, 180)
		).slice(0, 180)
		const description = readme.trim().slice(0, DESCRIPTION_MAX_LENGTH)
		return await ctx.runMutation(
			internal.functions.plugins.publishing.model.createDraft,
			{
				tokenIdentifier,
				repositoryId: args.repositoryId,
				name: name.slice(0, 80),
				slug: slugifyProjectName(name),
				summary,
				...(description ? { description } : {}),
				...(license ? { license } : {}),
			},
		)
	},
})

export const installWorkflow = action({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.object({
		commitSha: v.string(),
		url: v.string(),
		updated: v.boolean(),
		templateVersion: v.number(),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		commitSha: string
		url: string
		updated: boolean
		templateVersion: number
	}> => {
		const tokenIdentifier = await requireTokenIdentifier(ctx)
		await enforceRateLimit(ctx, 'workflowInstall', tokenIdentifier)
		const context: PublishingActionContext = await ctx.runQuery(
			internal.functions.plugins.publishing.model.getActionContext,
			{ tokenIdentifier, draftId: args.draftId },
		)
		const templateKey = context.draft.workflowTemplateKey
		if (!templateKey || !context.draft.projectId) {
			throw new ConvexError({
				code: 'WORKFLOW_NOT_SELECTED',
				message: 'Choose a publishing workflow before installing it.',
			})
		}
		const template = await ctx.runQuery(
			internal.functions.plugins.workflowTemplates.getTemplate,
			{ key: templateKey },
		)
		if (!template || template.softwareId !== context.draft.softwareId) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_UNAVAILABLE',
				message:
					'The selected workflow is no longer available for this plugin.',
			})
		}
		try {
			// Templates saved before the current rules may no longer pass them.
			validateWorkflowTemplate(template.content)
		} catch (error) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_OUTDATED',
				message: `This workflow needs an update by a BedrockNexus admin before it can be installed: ${errorText(error)}`,
			})
		}
		const generated = renderWorkflowTemplate(
			template.content,
			context.draft.name,
		)
		const { repository } = context
		const octokit = await installationOctokit(context.installationId)

		try {
			const existing = await blobShaAt(
				octokit,
				repository,
				generated.path,
				repository.defaultBranch,
			)
			const existingContent = existing?.content
				? Buffer.from(existing.content, 'base64').toString('utf8')
				: undefined
			if (existing && existingContent === generated.content) {
				let commitSha = context.draft.workflowCommitSha
				if (!commitSha) {
					const commits = await octokit.rest.repos.listCommits({
						owner: repository.ownerLogin,
						repo: repository.name,
						sha: repository.defaultBranch,
						path: generated.path,
						per_page: 1,
					})
					commitSha = commits.data[0]?.sha
				}
				if (!commitSha) {
					throw new ConvexError({
						code: 'WORKFLOW_COMMIT_MISSING',
						message:
							'GitHub did not return the commit that installed the workflow.',
					})
				}
				await ctx.runMutation(
					internal.functions.plugins.publishing.model
						.recordWorkflowCommit,
					{
						tokenIdentifier,
						draftId: args.draftId,
						branch: repository.defaultBranch,
						commitSha,
						workflowBlobSha: existing.sha,
						templateKey,
						templateVersion: template.version,
					},
				)
				return {
					commitSha,
					url: `${repository.htmlUrl}/blob/${encodeURIComponent(repository.defaultBranch)}/${generated.path}`,
					updated: false,
					templateVersion: template.version,
				}
			}

			const commit = await octokit.rest.repos.createOrUpdateFileContents({
				owner: repository.ownerLogin,
				repo: repository.name,
				path: generated.path,
				branch: repository.defaultBranch,
				message: existing
					? 'ci: update BedrockNexus publishing workflow'
					: 'ci: install BedrockNexus publishing workflow',
				content: Buffer.from(generated.content).toString('base64'),
				...(existing ? { sha: existing.sha } : {}),
			})
			const commitSha = commit.data.commit.sha
			const workflowBlobSha = commit.data.content?.sha
			if (!commitSha || !workflowBlobSha) {
				throw new ConvexError({
					code: 'WORKFLOW_COMMIT_MISSING',
					message:
						'GitHub created the workflow file without returning a commit SHA.',
				})
			}
			await ctx.runMutation(
				internal.functions.plugins.publishing.model.recordWorkflowCommit,
				{
					tokenIdentifier,
					draftId: args.draftId,
					branch: repository.defaultBranch,
					commitSha,
					workflowBlobSha,
					templateKey,
					templateVersion: template.version,
				},
			)
			return {
				commitSha,
				url:
					commit.data.commit.html_url ??
					`${repository.htmlUrl}/commit/${encodeURIComponent(commitSha)}`,
				updated: true,
				templateVersion: template.version,
			}
		} catch (error) {
			throwGitHubApiError(error)
		}
	},
})

// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

function buildStatus(status: string | null) {
	return status === 'completed'
		? ('completed' as const)
		: status === 'in_progress'
			? ('inProgress' as const)
			: ('queued' as const)
}

function buildConclusion(conclusion: string | null) {
	switch (conclusion) {
		case null:
			return undefined
		case 'success':
		case 'failure':
		case 'cancelled':
		case 'skipped':
			return conclusion
		case 'timed_out':
			return 'timedOut' as const
		case 'action_required':
			return 'actionRequired' as const
		default:
			return 'failure' as const
	}
}

/** Reads the managed workflow's recent runs and records them as builds. */
async function syncRepositoryBuilds(
	ctx: ActionCtx,
	repositoryId: Id<'githubRepositories'>,
) {
	const context = await ctx.runQuery(
		internal.functions.plugins.publishing.model.getBuildSyncContext,
		{ repositoryId },
	)
	if (!context) {
		return 0
	}
	const { repository } = context
	const octokit = await installationOctokit(context.installationId)
	try {
		let runs: Awaited<
			ReturnType<Octokit['rest']['actions']['listWorkflowRuns']>
		>['data']['workflow_runs']
		try {
			const response = await octokit.rest.actions.listWorkflowRuns({
				owner: repository.ownerLogin,
				repo: repository.name,
				workflow_id: WORKFLOW_FILE_NAME,
				per_page: RUNS_PER_SYNC,
			})
			runs = response.data.workflow_runs
		} catch (error) {
			// The workflow has not run yet, or the file was removed.
			if (isGitHubStatus(error, 404)) {
				return 0
			}
			throw error
		}

		const known = new Map(
			(
				await ctx.runQuery(
					internal.functions.plugins.publishing.model.listKnownBuilds,
					{ workflowRunIds: runs.map((run) => run.id) },
				)
			).map((build) => [build.workflowRunId, build]),
		)
		const builds = []
		for (const run of runs) {
			const status = buildStatus(run.status)
			const previous = known.get(run.id)
			// A finished build with its artifact and workflow checked is final.
			if (
				previous?.status === 'completed' &&
				previous.workflowBlobSha !== undefined
			) {
				continue
			}
			let artifact:
				| { id: number; size: number; expiresAt?: number }
				| undefined
			let workflowBlobSha: string | undefined
			if (status === 'completed') {
				const artifacts =
					await octokit.rest.actions.listWorkflowRunArtifacts({
						owner: repository.ownerLogin,
						repo: repository.name,
						run_id: run.id,
						name: ARTIFACT_NAME,
					})
				const match = artifacts.data.artifacts.find(
					(item) => item.name === ARTIFACT_NAME && !item.expired,
				)
				if (match) {
					artifact = {
						id: match.id,
						size: match.size_in_bytes,
						expiresAt: parseTimestamp(match.expires_at),
					}
				}
				workflowBlobSha =
					(await blobShaAt(octokit, repository, WORKFLOW_PATH, run.head_sha))
						?.sha ?? ''
			}
			const commitMessage = run.head_commit?.message
				?.split('\n')[0]
				?.slice(0, 200)
			builds.push({
				workflowRunId: run.id,
				workflowName: run.name ?? 'BedrockNexus Publish',
				event: run.event,
				commitSha: run.head_sha,
				...(commitMessage ? { commitMessage } : {}),
				...(run.head_branch ? { branch: run.head_branch } : {}),
				status,
				...(buildConclusion(run.conclusion)
					? { conclusion: buildConclusion(run.conclusion) }
					: {}),
				logsUrl: run.html_url,
				...(artifact
					? {
							artifactId: artifact.id,
							artifactSize: artifact.size,
							...(artifact.expiresAt
								? { artifactExpiresAt: artifact.expiresAt }
								: {}),
						}
					: {}),
				// An empty string records that the file was missing at that commit.
				...(workflowBlobSha !== undefined ? { workflowBlobSha } : {}),
				createdAt: parseTimestamp(run.created_at) ?? Date.now(),
				...(status === 'completed' && parseTimestamp(run.updated_at)
					? { completedAt: parseTimestamp(run.updated_at) }
					: {}),
			})
		}
		await ctx.runMutation(
			internal.functions.plugins.publishing.model.upsertBuilds,
			{ draftId: context.draftId, builds },
		)
		return builds.length
	} catch (error) {
		throwGitHubApiError(error)
	}
}

export const syncBuilds = action({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.number(),
	handler: async (ctx, args): Promise<number> => {
		const tokenIdentifier = await requireTokenIdentifier(ctx)
		await enforceRateLimit(ctx, 'githubRead', tokenIdentifier)
		const context: PublishingActionContext = await ctx.runQuery(
			internal.functions.plugins.publishing.model.getActionContext,
			{ tokenIdentifier, draftId: args.draftId },
		)
		return await syncRepositoryBuilds(ctx, context.repository._id)
	},
})

/** Called for workflow_run webhooks, so builds show up without a refresh. */
export const syncBuildsFromWebhook = internalAction({
	args: { repositoryId: v.id('githubRepositories') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await syncRepositoryBuilds(ctx, args.repositoryId)
		return null
	},
})

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

async function getReleaseContext(
	ctx: ActionCtx,
	releaseId: Id<'pluginReleases'>,
): Promise<ReleaseActionContext | null> {
	return await ctx.runQuery(
		internal.functions.plugins.publishing.model.getReleaseActionContext,
		{ releaseId },
	)
}

/**
 * Copies the build of a release sent to review from GitHub into private
 * storage. GitHub artifacts need a token to download and expire, and
 * moderators must review the exact file that gets published.
 */
export const prepareRelease = internalAction({
	args: { releaseId: v.id('pluginReleases') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const context = await getReleaseContext(ctx, args.releaseId)
		if (context?.release.status !== 'preparing') {
			return null
		}
		const fail = async (reason: string) => {
			await ctx.runMutation(
				internal.functions.plugins.publishing.model.failPreparation,
				{ releaseId: args.releaseId, reason },
			)
		}
		if (!context.installationId || !context.artifactId) {
			await fail('The build’s files are no longer available on GitHub.')
			return null
		}
		if (!context.fileExtension) {
			await fail('This server software does not accept plugins right now.')
			return null
		}
		if ((context.artifactSize ?? 0) > MAX_PLUGIN_FILE_BYTES) {
			await fail('The build is larger than 50 MB.')
			return null
		}
		let uploadKey: string | undefined
		try {
			const octokit = await installationOctokit(context.installationId)
			const archive = await octokit.rest.actions.downloadArtifact({
				owner: context.repository.ownerLogin,
				repo: context.repository.name,
				artifact_id: context.artifactId,
				archive_format: 'zip',
			})
			const extracted = extractPluginFile(
				new Uint8Array(archive.data as ArrayBuffer),
				context.fileExtension,
			)
			const file = {
				fileName: sanitizeR2FileName(extracted.fileName),
				data: extracted.data,
			}
			const sha256 = createHash('sha256').update(file.data).digest('hex')
			uploadKey = buildPluginReviewR2ObjectKey({
				projectId: context.projectId,
				releaseId: args.releaseId,
				fileName: file.fileName,
			})
			await r2S3.send(
				new PutObjectCommand({
					Bucket: uploadsR2.config.bucket,
					Key: uploadKey,
					Body: file.data,
					ContentType: 'application/octet-stream',
				}),
			)
			const accepted = await ctx.runMutation(
				internal.functions.plugins.publishing.model.finishPreparation,
				{
					releaseId: args.releaseId,
					fileName: file.fileName,
					size: file.data.byteLength,
					sha256,
					uploadKey,
				},
			)
			if (!accepted) {
				await r2S3.send(
					new DeleteObjectCommand({
						Bucket: uploadsR2.config.bucket,
						Key: uploadKey,
					}),
				)
			}
		} catch (error) {
			console.error('Preparing plugin release failed', error)
			await fail(
				error instanceof ArtifactError
					? error.message
					: 'The build could not be copied from GitHub. Try sending it again.',
			)
		}
		return null
	},
})

/** A short-lived link to the file of a version in review, for moderators. */
export const getReviewDownloadUrl = action({
	args: { releaseId: v.id('pluginReleases') },
	returns: v.string(),
	handler: async (ctx, args): Promise<string> => {
		const tokenIdentifier = await requireTokenIdentifier(ctx)
		const file: { uploadKey: string; fileName: string } | null =
			await ctx.runQuery(
				internal.functions.plugins.publishing.model.getReviewFile,
				{ tokenIdentifier, releaseId: args.releaseId },
			)
		if (!file) {
			throw new ConvexError({
				code: 'REVIEW_FILE_MISSING',
				message: 'This version has no file to review.',
			})
		}
		return await uploadsR2.getUrl(file.uploadKey, {
			expiresIn: REVIEW_LINK_SECONDS,
		})
	},
})

function attachmentDisposition(fileName: string) {
	const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download'
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/** Moves an approved version's file to the public CDN, then makes it live. */
export const publishRelease = internalAction({
	args: { releaseId: v.id('pluginReleases') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const context = await getReleaseContext(ctx, args.releaseId)
		const release = context?.release
		if (!context || release?.status !== 'publishing') {
			return null
		}
		try {
			if (!release.uploadKey || !release.fileName) {
				throw new Error('The reviewed file is missing.')
			}
			const cdnKey = buildPluginDownloadR2ObjectKey({
				projectId: context.projectId,
				version: release.version,
				fileName: release.fileName,
			})
			await r2S3.send(
				new HeadObjectCommand({
					Bucket: uploadsR2.config.bucket,
					Key: release.uploadKey,
				}),
			)
			await r2S3.send(
				new CopyObjectCommand({
					Bucket: cdnR2.config.bucket,
					Key: cdnKey,
					CopySource: `${uploadsR2.config.bucket}/${release.uploadKey
						.split('/')
						.map(encodeURIComponent)
						.join('/')}`,
					MetadataDirective: 'REPLACE',
					ContentType: 'application/octet-stream',
					ContentDisposition: attachmentDisposition(release.fileName),
					CacheControl: 'public, max-age=31536000, immutable',
				}),
			)
			const published = await ctx.runMutation(
				internal.functions.plugins.publishing.model.finishPublishing,
				{ releaseId: release._id, cdnKey },
			)
			if (published) {
				await deleteReviewCopy(ctx, release._id, release.uploadKey)
			}
		} catch (error) {
			console.error('Publishing plugin release failed', error)
			await ctx.runMutation(
				internal.functions.plugins.publishing.model
					.recordPublishingError,
				{
					releaseId: release._id,
					reason: `The file could not be published: ${errorText(error)}`,
				},
			)
		}
		return null
	},
})

async function deleteReviewCopy(
	ctx: ActionCtx,
	releaseId: Id<'pluginReleases'>,
	uploadKey: string,
) {
	await r2S3.send(
		new DeleteObjectCommand({
			Bucket: uploadsR2.config.bucket,
			Key: uploadKey,
		}),
	)
	await ctx.runMutation(
		internal.functions.plugins.publishing.model.clearUploadKey,
		{ releaseId, uploadKey },
	)
}

/** Removes the private copy of a version that will not be published. */
export const deleteReviewFile = internalAction({
	args: { releaseId: v.id('pluginReleases'), uploadKey: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await deleteReviewCopy(ctx, args.releaseId, args.uploadKey)
		return null
	},
})

/** Deletes the stored files of a deleted plugin's releases. */
export const deleteStoredFiles = internalAction({
	args: {
		files: v.array(
			v.object({
				bucket: v.union(v.literal('uploads'), v.literal('cdn')),
				key: v.string(),
			}),
		),
	},
	returns: v.null(),
	handler: async (_ctx, args) => {
		const results = await Promise.allSettled(
			args.files.map((file) =>
				r2S3.send(
					new DeleteObjectCommand({
						Bucket:
							file.bucket === 'cdn'
								? cdnR2.config.bucket
								: uploadsR2.config.bucket,
						Key: file.key,
					}),
				),
			),
		)
		for (const [index, result] of results.entries()) {
			if (result.status === 'rejected') {
				console.error(
					`Could not delete plugin file ${args.files[index]?.key}`,
					result.reason,
				)
			}
		}
		return null
	},
})

/** The commit a tag points at, following annotated tags. */
async function tagCommitSha(
	octokit: Octokit,
	repository: { ownerLogin: string; name: string },
	tag: string,
) {
	try {
		const ref = await octokit.rest.git.getRef({
			owner: repository.ownerLogin,
			repo: repository.name,
			ref: `tags/${tag}`,
		})
		if (ref.data.object.type !== 'tag') {
			return ref.data.object.sha
		}
		const annotated = await octokit.rest.git.getTag({
			owner: repository.ownerLogin,
			repo: repository.name,
			tag_sha: ref.data.object.sha,
		})
		return annotated.data.object.sha
	} catch (error) {
		if (isGitHubStatus(error, 404)) {
			return undefined
		}
		throw error
	}
}

/**
 * Creates the GitHub release of a published version: tag `v{version}` on the
 * build's commit, the changelog as notes, and the published file attached.
 * It is a copy for people browsing GitHub; downloads are served from the CDN.
 * An existing tag on another commit is never moved.
 */
export const createGitHubRelease = internalAction({
	args: { releaseId: v.id('pluginReleases') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const context = await getReleaseContext(ctx, args.releaseId)
		const release = context?.release
		if (!context || release?.status !== 'published') {
			return null
		}
		const record = async (
			result:
				| { status: 'created'; githubReleaseId: number; url: string }
				| { status: 'failed'; error: string; githubReleaseId?: number },
		) => {
			await ctx.runMutation(
				internal.functions.plugins.publishing.model.recordGitHubRelease,
				{ releaseId: release._id, ...result },
			)
		}
		if (!context.installationId) {
			await record({
				status: 'failed',
				error: 'The GitHub App no longer has access to this repository.',
			})
			return null
		}
		const { repository } = context
		const tag = releaseTagFor(release.version)
		let githubReleaseId = release.githubReleaseId
		try {
			if (!release.cdnKey || !release.fileName) {
				throw new Error('The published file is missing.')
			}
			const octokit = await installationOctokit(context.installationId)
			const taggedCommit = await tagCommitSha(octokit, repository, tag)
			if (taggedCommit && taggedCommit !== release.commitSha) {
				await record({
					status: 'failed',
					error: `The tag ${tag} already exists on another commit, so no GitHub release was created. BedrockNexus never moves existing tags.`,
				})
				return null
			}

			let githubRelease:
				| { id: number; html_url: string; assets: Array<{ name: string }> }
				| undefined
			try {
				const existing = await octokit.rest.repos.getReleaseByTag({
					owner: repository.ownerLogin,
					repo: repository.name,
					tag,
				})
				if (existing.data.id !== githubReleaseId) {
					await record({
						status: 'failed',
						error: `A GitHub release for ${tag} already exists, so BedrockNexus did not create another.`,
					})
					return null
				}
				githubRelease = existing.data
			} catch (error) {
				if (!isGitHubStatus(error, 404)) {
					throw error
				}
			}

			if (!githubRelease) {
				const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '')
				const created = await octokit.rest.repos.createRelease({
					owner: repository.ownerLogin,
					repo: repository.name,
					tag_name: tag,
					target_commitish: release.commitSha,
					name: `${context.projectName} ${release.version}`,
					body: [
						release.changelog,
						'---',
						...(siteUrl
							? [
									`Published on BedrockNexus: ${siteUrl}/plugins/${context.projectSlug}`,
								]
							: []),
						`SHA-256 of ${release.fileName}: \`${release.sha256 ?? 'unknown'}\``,
					].join('\n\n'),
				})
				githubRelease = created.data
				githubReleaseId = created.data.id
			}

			if (!githubRelease.assets.some((asset) => asset.name === release.fileName)) {
				const object = await r2S3.send(
					new GetObjectCommand({
						Bucket: cdnR2.config.bucket,
						Key: release.cdnKey,
					}),
				)
				const data = Buffer.from(
					(await object.Body?.transformToByteArray()) ?? [],
				)
				if (data.byteLength === 0) {
					throw new Error('The published file could not be read.')
				}
				await octokit.rest.repos.uploadReleaseAsset({
					owner: repository.ownerLogin,
					repo: repository.name,
					release_id: githubRelease.id,
					name: release.fileName,
					// Octokit types the body as a string; it sends Buffers as-is.
					data: data as unknown as string,
					headers: {
						'content-type': 'application/octet-stream',
						'content-length': data.byteLength,
					},
				})
			}
			await record({
				status: 'created',
				githubReleaseId: githubRelease.id,
				url: githubRelease.html_url,
			})
		} catch (error) {
			console.error('Creating GitHub release failed', error)
			await record({
				status: 'failed',
				error: `GitHub did not accept the release: ${errorText(error)}`,
				...(githubReleaseId ? { githubReleaseId } : {}),
			})
		}
		return null
	},
})
