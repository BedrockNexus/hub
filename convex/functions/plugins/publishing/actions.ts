'use node'

import { Buffer } from 'node:buffer'

import { ConvexError, v } from 'convex/values'

import {
	type AdapterId,
	createRepositorySnapshot,
	detectCompatibleAdapters,
	getAdapterById,
	type RepositoryFile,
	type RepositorySnapshot,
} from '../../../../lib/plugins/adapters'
import { renderWorkflowTemplate } from '../../../../lib/plugins/adapters/workflow-templates'
import {
	sanitizeReadmeExcerpt,
	slugifyProjectName,
} from '../../../../lib/plugins/publishing/metadata'
import { internal } from '../../../_generated/api'
import type { Doc, Id } from '../../../_generated/dataModel'
import { type ActionCtx, action, env } from '../../../_generated/server'
import { enforceRateLimit } from '../../../lib/plugins/rateLimits'
import {
	createGitHubApp,
	requireGitHubAppConfig,
	throwGitHubApiError,
} from '../github/lib/app'

const adapterIdValidator = v.union(
	v.literal('pocketmine-mp'),
	v.literal('powernukkitx'),
)
const workflowPath = '.github/workflows/bedrocknexus-publish.yml' as const

type PublishingActionContext = {
	draft: Doc<'pluginPublishingDrafts'>
	repository: Doc<'githubRepositories'>
	installationId: number
}

type PublishingRefreshResult = {
	verifiedBuild: boolean
	readyToPublish: boolean
}

function getConfig() {
	return requireGitHubAppConfig({
		appId: process.env.GITHUB_APP_ID,
		clientId: process.env.GITHUB_APP_CLIENT_ID,
		clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
		privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
		slug: process.env.GITHUB_APP_SLUG,
	})
}

function requireTokenIdentifier(
	identity: Awaited<ReturnType<ActionCtx['auth']['getUserIdentity']>>,
) {
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

function isRelevantContentPath(path: string) {
	return (
		/(^|\/)(plugin\.ya?ml|composer\.json|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|gradlew|mvnw)$/i.test(
			path,
		) || /^readme(?:\.[a-z0-9]+)?$/i.test(path)
	)
}

async function loadRepositorySnapshot(
	installationId: number,
	repository: {
		ownerLogin: string
		name: string
		fullName: string
		defaultBranch: string
	},
) {
	const app = createGitHubApp(getConfig())
	const octokit = await app.getInstallationOctokit(installationId)
	try {
		const [tree, metadata] = await Promise.all([
			octokit.rest.git.getTree({
				owner: repository.ownerLogin,
				repo: repository.name,
				tree_sha: repository.defaultBranch,
				recursive: 'true',
			}),
			octokit.rest.repos.get({
				owner: repository.ownerLogin,
				repo: repository.name,
			}),
		])
		if (tree.data.truncated) {
			throw new ConvexError({
				code: 'REPOSITORY_TREE_TRUNCATED',
				message:
					'This repository is too large to inspect safely. Reduce generated files first.',
			})
		}

		const files: Array<RepositoryFile> = tree.data.tree.flatMap((entry) =>
			entry.path && entry.type === 'blob' ? [{ path: entry.path }] : [],
		)
		const contentFiles = files
			.filter((file) => isRelevantContentPath(file.path))
			.slice(0, 30)
		await Promise.all(
			contentFiles.map(async (file) => {
				const response = await octokit.rest.repos.getContent({
					owner: repository.ownerLogin,
					repo: repository.name,
					path: file.path,
					ref: repository.defaultBranch,
				})
				if (
					!Array.isArray(response.data) &&
					response.data.type === 'file' &&
					response.data.content
				) {
					file.content = Buffer.from(
						response.data.content,
						'base64',
					).toString('utf8')
				}
			}),
		)
		return {
			octokit,
			snapshot: createRepositorySnapshot(
				repository.fullName,
				repository.defaultBranch,
				files,
			),
			repositoryLicense:
				metadata.data.license?.spdx_id &&
				metadata.data.license.spdx_id !== 'NOASSERTION'
					? metadata.data.license.spdx_id
					: undefined,
		}
	} catch (error) {
		throwGitHubApiError(error)
	}
}

function selectAdapter(snapshot: RepositorySnapshot, override?: AdapterId) {
	const resolution = detectCompatibleAdapters(snapshot)
	if (override) {
		const adapter = getAdapterById(override)
		const detection = resolution.candidates.find(
			(candidate) => candidate.adapterId === override,
		)
		if (!adapter || !detection || detection.score <= 0) {
			throw new ConvexError({
				code: 'ADAPTER_OVERRIDE_INVALID',
				message:
					'The selected adapter is incompatible with this repository.',
			})
		}
		return { adapter, detection }
	}
	if (resolution.kind !== 'matched') {
		throw new ConvexError({
			code:
				resolution.kind === 'ambiguous'
					? 'ADAPTER_AMBIGUOUS'
					: 'ADAPTER_UNSUPPORTED',
			message: resolution.explanation,
		})
	}
	const adapter = getAdapterById(resolution.selected.adapterId)
	if (!adapter) {
		throw new ConvexError({
			code: 'ADAPTER_DISABLED',
			message: 'The adapter is unavailable.',
		})
	}
	return { adapter, detection: resolution.selected }
}

function analyzeSnapshot(snapshot: RepositorySnapshot, override?: AdapterId) {
	const { adapter, detection } = selectAdapter(snapshot, override)
	const metadata = adapter.extractMetadata(snapshot)
	const validation = adapter.validate(snapshot)
	if (!metadata.ok || !validation.valid) {
		const issues = metadata.ok ? validation.issues : metadata.errors
		throw new ConvexError({
			code: 'REPOSITORY_VALIDATION_FAILED',
			message: issues.map((issue) => issue.message).join(' '),
		})
	}
	return { adapter, detection, metadata: metadata.metadata }
}

export const analyzeRepository = action({
	args: {
		repositoryId: v.id('githubRepositories'),
		adapterOverride: v.optional(adapterIdValidator),
	},
	returns: v.object({
		draftId: v.id('pluginPublishingDrafts'),
		adapterId: adapterIdValidator,
		adapterName: v.string(),
		detectionScore: v.number(),
		detectionSummary: v.string(),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		draftId: Id<'pluginPublishingDrafts'>
		adapterId: AdapterId
		adapterName: string
		detectionScore: number
		detectionSummary: string
	}> => {
		const identity = await ctx.auth.getUserIdentity()
		const tokenIdentifier = requireTokenIdentifier(identity)
		await enforceRateLimit(ctx, 'githubRead', tokenIdentifier)
		const access: {
			installationId: number
			repositoryId: Id<'githubRepositories'>
			ownerLogin: string
			name: string
			fullName: string
			defaultBranch: string
			description?: string
		} = await ctx.runQuery(
			internal.functions.plugins.github.installations.getRepositoryAccess,
			{
				tokenIdentifier,
				repositoryId: args.repositoryId,
			},
		)
		const { repositoryLicense, snapshot } = await loadRepositorySnapshot(
			access.installationId,
			access,
		)
		const analysis = analyzeSnapshot(snapshot, args.adapterOverride)
		const readme =
			snapshot.files.find((file) =>
				/^readme(?:\.[a-z0-9]+)?$/i.test(file.path),
			)?.content ?? ''
		const readmeExcerpt = sanitizeReadmeExcerpt(readme)
		const detectedLicense = repositoryLicense ?? analysis.metadata.license
		const summary = (
			access.description ||
			analysis.metadata.description ||
			readmeExcerpt ||
			`${analysis.metadata.name} plugin for ${analysis.adapter.name}.`
		).slice(0, 180)
		const draftId: Id<'pluginPublishingDrafts'> = await ctx.runMutation(
			internal.functions.plugins.publishing.model.upsertAnalysis,
			{
				tokenIdentifier,
				analysis: {
					repositoryId: args.repositoryId,
					adapterId: analysis.adapter.id,
					detectionScore: analysis.detection.score,
					detectionSummary: analysis.detection.summary,
					name: analysis.metadata.name,
					slug: slugifyProjectName(analysis.metadata.name),
					summary,
					...(readmeExcerpt
						? { description: readmeExcerpt, readmeExcerpt }
						: {}),
					...(detectedLicense ? { license: detectedLicense } : {}),
				},
			},
		)
		return {
			draftId,
			adapterId: analysis.adapter.id,
			adapterName: analysis.adapter.name,
			detectionScore: analysis.detection.score,
			detectionSummary: analysis.detection.summary,
		}
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
		const identity = await ctx.auth.getUserIdentity()
		const tokenIdentifier = requireTokenIdentifier(identity)
		await enforceRateLimit(ctx, 'workflowInstall', tokenIdentifier)
		const context: PublishingActionContext = await ctx.runQuery(
			internal.functions.plugins.publishing.model.getActionContext,
			{
				tokenIdentifier,
				draftId: args.draftId,
			},
		)
		if (context.draft.status === 'inReview') {
			throw new ConvexError({
				code: 'PUBLISHING_DRAFT_LOCKED',
				message:
					'The workflow is locked while this release is under review.',
			})
		}
		const { octokit, snapshot } = await loadRepositorySnapshot(
			context.installationId,
			context.repository,
		)
		const analysis = analyzeSnapshot(snapshot, context.draft.adapterId)
		const templateKey = context.draft.workflowTemplateKey
		if (!templateKey) {
			throw new ConvexError({
				code: 'WORKFLOW_NOT_SELECTED',
				message: 'Choose a publishing workflow before installing it.',
			})
		}
		const template = await ctx.runQuery(
			internal.functions.plugins.workflowTemplates.getTemplate,
			{
				key: templateKey,
			},
		)
		if (!template || template.adapterId !== context.draft.adapterId) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_UNAVAILABLE',
				message:
					'The selected workflow is no longer available for this project.',
			})
		}
		const generated = renderWorkflowTemplate(
			template.content,
			analysis.metadata.name,
		)
		const templateVersion = template.version

		try {
			let existing:
				| {
						sha: string
						content: string
						htmlUrl: string
				  }
				| undefined
			try {
				const response = await octokit.rest.repos.getContent({
					owner: context.repository.ownerLogin,
					repo: context.repository.name,
					path: generated.path,
					ref: context.repository.defaultBranch,
				})
				if (
					!Array.isArray(response.data) &&
					response.data.type === 'file' &&
					response.data.content
				) {
					existing = {
						sha: response.data.sha,
						content: Buffer.from(
							response.data.content,
							'base64',
						).toString('utf8'),
						htmlUrl:
							response.data.html_url ??
							context.repository.htmlUrl,
					}
				}
			} catch (error) {
				if (!isGitHubStatus(error, 404)) {
					throw error
				}
			}

			if (existing?.content === generated.content) {
				let commitSha = context.draft.workflowCommitSha
				if (!commitSha) {
					const commits = await octokit.rest.repos.listCommits({
						owner: context.repository.ownerLogin,
						repo: context.repository.name,
						sha: context.repository.defaultBranch,
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
						branch: context.repository.defaultBranch,
						commitSha,
						workflowBlobSha: existing.sha,
						templateKey,
						templateVersion,
					},
				)
				return {
					commitSha,
					url: existing.htmlUrl,
					updated: false,
					templateVersion,
				}
			}

			const commit = await octokit.rest.repos.createOrUpdateFileContents({
				owner: context.repository.ownerLogin,
				repo: context.repository.name,
				path: generated.path,
				branch: context.repository.defaultBranch,
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
				internal.functions.plugins.publishing.model
					.recordWorkflowCommit,
				{
					tokenIdentifier,
					draftId: args.draftId,
					branch: context.repository.defaultBranch,
					commitSha,
					workflowBlobSha,
					templateKey,
					templateVersion,
				},
			)
			return {
				commitSha,
				url:
					commit.data.commit.html_url ??
					`${context.repository.htmlUrl}/commit/${encodeURIComponent(commitSha)}`,
				updated: true,
				templateVersion,
			}
		} catch (error) {
			throwGitHubApiError(error)
		}
	},
})

function validPrimaryAsset(adapterId: AdapterId, name: string) {
	if (adapterId === 'pocketmine-mp') {
		return /\.phar$/i.test(name)
	}
	return (
		/\.jar$/i.test(name) &&
		!/(?:^|[-_.])(sources?|javadoc|tests?|plain|original)(?:[-_.]|$)/i.test(
			name,
		)
	)
}

async function refreshState(
	ctx: ActionCtx,
	tokenIdentifier: string,
	draftId: Id<'pluginPublishingDrafts'>,
): Promise<PublishingRefreshResult> {
	const context: PublishingActionContext = await ctx.runQuery(
		internal.functions.plugins.publishing.model.getActionContext,
		{
			tokenIdentifier,
			draftId,
		},
	)
	const app = createGitHubApp(getConfig())
	const octokit = await app.getInstallationOctokit(context.installationId)
	try {
		let pullRequestState: 'open' | 'closed' | 'merged' | undefined
		if (context.draft.workflowPullRequestNumber) {
			const pull = await octokit.rest.pulls.get({
				owner: context.repository.ownerLogin,
				repo: context.repository.name,
				pull_number: context.draft.workflowPullRequestNumber,
			})
			pullRequestState = pull.data.merged ? 'merged' : pull.data.state
		}

		let workflowInstalled = false
		try {
			const workflowFile = await octokit.rest.repos.getContent({
				owner: context.repository.ownerLogin,
				repo: context.repository.name,
				path: workflowPath,
				ref: context.repository.defaultBranch,
			})
			workflowInstalled =
				!Array.isArray(workflowFile.data) &&
				workflowFile.data.type === 'file'
		} catch (error) {
			if (!isGitHubStatus(error, 404)) {
				throw error
			}
		}

		let workflowRuns:
			| Awaited<
					ReturnType<typeof octokit.rest.actions.listWorkflowRuns>
			  >['data']['workflow_runs']
			| undefined
		if (workflowInstalled) {
			const runs = await octokit.rest.actions.listWorkflowRuns({
				owner: context.repository.ownerLogin,
				repo: context.repository.name,
				workflow_id: workflowPath,
				per_page: 20,
			})
			workflowRuns = runs.data.workflow_runs
		}

		const workflowBlobShaByCommit = new Map<string, string | undefined>()
		const workflowBlobShaAt = async (ref: string) => {
			if (workflowBlobShaByCommit.has(ref)) {
				return workflowBlobShaByCommit.get(ref)
			}
			let blobSha: string | undefined
			try {
				const file = await octokit.rest.repos.getContent({
					owner: context.repository.ownerLogin,
					repo: context.repository.name,
					path: workflowPath,
					ref,
				})
				blobSha =
					!Array.isArray(file.data) && file.data.type === 'file'
						? file.data.sha
						: undefined
			} catch (error) {
				if (!isGitHubStatus(error, 404)) {
					throw error
				}
			}
			workflowBlobShaByCommit.set(ref, blobSha)
			return blobSha
		}

		const detectedReleases: Array<{
			id: number
			url: string
			tag: string
			commitSha: string
			version: string
			publishedAt?: number
			asset: {
				id: number
				name: string
				url: string
				size: number
				contentType?: string
				digest?: string
			}
			provenance: {
				releaseAuthor?: string
				assetUploader?: string
				assetCreatedAt?: number
				workflowBlobShaAtCommit?: string
			}
		}> = []
		const githubReleases = await octokit.rest.repos.listReleases({
			owner: context.repository.ownerLogin,
			repo: context.repository.name,
			per_page: 20,
		})
		for (const candidate of githubReleases.data) {
			const asset = candidate.assets.find(
				(item) =>
					item.size > 0 &&
					validPrimaryAsset(context.draft.adapterId, item.name),
			)
			if (
				candidate.draft ||
				!/^v[^/]+$/.test(candidate.tag_name) ||
				!asset
			) {
				continue
			}
			const commit = await octokit.rest.repos.getCommit({
				owner: context.repository.ownerLogin,
				repo: context.repository.name,
				ref: candidate.tag_name,
			})
			const assetDigest =
				(asset as { digest?: string | null }).digest ?? undefined
			const assetCreatedAt = parseTimestamp(asset.created_at)
			const workflowBlobShaAtCommit = await workflowBlobShaAt(
				commit.data.sha,
			)
			detectedReleases.push({
				id: candidate.id,
				url: candidate.html_url,
				tag: candidate.tag_name,
				commitSha: commit.data.sha,
				version: candidate.tag_name.slice(1),
				...(parseTimestamp(candidate.published_at)
					? { publishedAt: parseTimestamp(candidate.published_at) }
					: {}),
				asset: {
					id: asset.id,
					name: asset.name,
					url: asset.browser_download_url,
					size: asset.size,
					...(asset.content_type
						? { contentType: asset.content_type }
						: {}),
					...(assetDigest ? { digest: assetDigest } : {}),
				},
				provenance: {
					...(candidate.author?.login
						? { releaseAuthor: candidate.author.login }
						: {}),
					...(asset.uploader?.login
						? { assetUploader: asset.uploader.login }
						: {}),
					...(assetCreatedAt ? { assetCreatedAt } : {}),
					...(workflowBlobShaAtCommit
						? { workflowBlobShaAtCommit }
						: {}),
				},
			})
		}

		const recordRelease = async (
			release: (typeof detectedReleases)[number] | undefined,
		): Promise<PublishingRefreshResult> => {
			const selectedRun =
				(release
					? workflowRuns?.find(
							(candidate) =>
								candidate.head_branch === release.tag &&
								candidate.head_sha === release.commitSha,
						)
					: undefined) ?? workflowRuns?.[0]
			const run = selectedRun
				? {
						id: selectedRun.id,
						url: selectedRun.html_url,
						status: selectedRun.status ?? 'queued',
						...(selectedRun.conclusion
							? { conclusion: selectedRun.conclusion }
							: {}),
						commitSha: selectedRun.head_sha,
						...(selectedRun.head_branch?.startsWith('v')
							? { tag: selectedRun.head_branch }
							: {}),
						createdAt:
							parseTimestamp(selectedRun.created_at) ??
							Date.now(),
						...(parseTimestamp(selectedRun.run_started_at)
							? {
									startedAt: parseTimestamp(
										selectedRun.run_started_at,
									),
								}
							: {}),
						...(parseTimestamp(selectedRun.updated_at)
							? {
									completedAt: parseTimestamp(
										selectedRun.updated_at,
									),
								}
							: {}),
					}
				: undefined
			return await ctx.runMutation(
				internal.functions.plugins.publishing.model.recordGitHubState,
				{
					tokenIdentifier,
					draftId,
					...(pullRequestState ? { pullRequestState } : {}),
					workflowInstalled,
					...(run ? { run } : {}),
					...(release ? { release } : {}),
				},
			)
		}

		if (detectedReleases.length === 0) {
			return await recordRelease(undefined)
		}
		let result: PublishingRefreshResult = {
			verifiedBuild: false,
			readyToPublish: false,
		}
		for (const release of [...detectedReleases].reverse()) {
			result = await recordRelease(release)
		}
		return result
	} catch (error) {
		throwGitHubApiError(error)
	}
}

export const refreshPublishingState = action({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.object({
		verifiedBuild: v.boolean(),
		readyToPublish: v.boolean(),
	}),
	handler: async (ctx, args): Promise<PublishingRefreshResult> => {
		const identity = await ctx.auth.getUserIdentity()
		const tokenIdentifier = requireTokenIdentifier(identity)
		await enforceRateLimit(ctx, 'githubRead', tokenIdentifier)
		return await refreshState(ctx, tokenIdentifier, args.draftId)
	},
})
