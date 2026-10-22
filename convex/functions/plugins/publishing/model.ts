import { ConvexError, v } from 'convex/values'

import { recordAdminAction } from '../../../lib/audit'
import { assertOptionalHttpUrl } from '../../../lib/contentValidation'
import { parsePluginDashboardId } from '../../../../lib/plugins/plugin-dashboard-id'
import {
	projectMetadataSchema,
	releaseSubmissionSchema,
} from '../../../../lib/plugins/publishing/metadata'
import { internal } from '../../../_generated/api'
import type { Doc, Id } from '../../../_generated/dataModel'
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
} from '../../../_generated/server'
import {
	type AppUser,
	getUserByTokenIdentifier,
	isStaff,
} from '../../../lib/plugins/access'
import {
	adminMutation,
	adminQuery,
	authedMutation,
	authedQuery,
} from '../../../lib/functions'
import {
	getActiveOrganizationMembership,
	listOrganizationMemberships,
	requireOrganizationManager,
} from '../../../lib/plugins/authorization'
import {
	insertProjectAggregates,
	replaceProjectAggregates,
} from '../../../lib/plugins/aggregates'
import { enforceRateLimit } from '../../../lib/plugins/rateLimits'
import { deleteIcon } from '../icons'
import {
	listResolvedWorkflowTemplates,
	resolveWorkflowTemplate,
} from '../../../lib/plugins/workflowTemplates'
import {
	buildConclusionValidator,
	buildStatusValidator,
	githubReleaseStatusValidator,
	publishingDraftValidator,
	releaseStatusValidator,
	repositoryValidator,
	workflowTemplateKeyValidator,
} from '../../../schemas/plugins'

/**
 * Publishing a plugin, from the developer's side:
 *
 * 1. Pick a public repository: its name, description, README and license
 *    prefill the details (actions:startFromRepository).
 * 2. Edit the details (saveMetadata).
 * 3. Pick a workflow template, which sets the server software and creates the
 *    plugin (selectWorkflow), then commit it to the repository
 *    (actions:installWorkflow).
 * 4. Every push builds the plugin; builds are synced from GitHub
 *    (actions:syncBuilds, also triggered by workflow_run webhooks).
 * 5. Pick a successful build, give it a version and a changelog, and send it
 *    to review (submitRelease). The file is copied into private storage
 *    (actions:prepareRelease) so the reviewed file is the published one.
 *
 * Then a moderator approves (approveReview): the file is copied to the public
 * CDN and the version goes live (actions:publishRelease), and a GitHub release
 * with the file attached is created (actions:createGitHubRelease).
 */

const ACTIVE_RELEASE_STATUSES = ['preparing', 'inReview', 'publishing'] as const

// Releases whose version number may be used again by a later submission.
const REUSABLE_VERSION_STATUSES: ReadonlySet<Doc<'pluginReleases'>['status']> =
	new Set(['preparationFailed', 'changesRequested', 'rejected'])
// Releases whose build may be sent again; a rejected build may not.
const REUSABLE_BUILD_STATUSES: ReadonlySet<Doc<'pluginReleases'>['status']> =
	new Set(['preparationFailed', 'changesRequested'])

export async function requireOwnedDraft(
	ctx: QueryCtx | MutationCtx,
	draftId: Id<'pluginPublishingDrafts'>,
	user: AppUser,
) {
	const draft = await ctx.db.get('pluginPublishingDrafts', draftId)
	if (!draft) {
		throw new ConvexError({
			code: 'PUBLISHING_DRAFT_NOT_FOUND',
			message: 'The plugin was not found.',
		})
	}
	if (draft.ownerType === 'organization') {
		await requireOrganizationManager(ctx, draft.ownerId, user)
	} else if (draft.ownerId !== user._id) {
		throw new ConvexError({
			code: 'PUBLISHING_DRAFT_NOT_FOUND',
			message: 'The plugin was not found.',
		})
	}
	return draft
}

/** The repository and its installation, when the user manages them. */
async function requireManagedRepository(
	ctx: QueryCtx | MutationCtx,
	repositoryId: Id<'githubRepositories'>,
	user: AppUser,
) {
	const repository = await ctx.db.get('githubRepositories', repositoryId)
	if (
		!repository ||
		repository.isPrivate ||
		repository.accessStatus !== 'granted'
	) {
		throw new ConvexError({
			code: 'REPOSITORY_INELIGIBLE',
			message:
				'Only a public repository the GitHub App can access can be published.',
		})
	}
	const installation = await ctx.db.get(
		'githubInstallations',
		repository.installationId,
	)
	if (!installation) {
		throw new ConvexError({
			code: 'FORBIDDEN',
			message: 'You do not manage this repository.',
		})
	}
	if (installation.ownerType === 'organization') {
		await requireOrganizationManager(ctx, installation.ownerId, user)
	} else if (installation.ownerId !== user._id) {
		throw new ConvexError({
			code: 'FORBIDDEN',
			message: 'You do not manage this repository.',
		})
	}
	return { repository, installation }
}

async function activeReleaseFor(
	ctx: QueryCtx | MutationCtx,
	projectId: Id<'plugins'>,
) {
	for (const status of ACTIVE_RELEASE_STATUSES) {
		const release = await ctx.db
			.query('pluginReleases')
			.withIndex('by_project_id_and_status', (query) =>
				query.eq('projectId', projectId).eq('status', status),
			)
			.first()
		if (release) {
			return release
		}
	}
	return null
}

async function assertNotUnderReview(
	ctx: QueryCtx | MutationCtx,
	draft: Doc<'pluginPublishingDrafts'>,
	message: string,
) {
	if (draft.projectId && (await activeReleaseFor(ctx, draft.projectId))) {
		throw new ConvexError({ code: 'PUBLISHING_DRAFT_LOCKED', message })
	}
}

function validatedMetadata(input: {
	name: string
	slug: string
	summary: string
	description?: string
}) {
	const result = projectMetadataSchema.safeParse(input)
	if (!result.success) {
		throw new ConvexError({
			code: 'INVALID_PROJECT_METADATA',
			message:
				result.error.issues[0]?.message ?? 'The plugin details are invalid.',
		})
	}
	return result.data
}

async function assertSlugAvailable(
	ctx: QueryCtx | MutationCtx,
	slug: string,
	projectId: Id<'plugins'> | undefined,
) {
	const slugOwner = await ctx.db
		.query('plugins')
		.withIndex('by_slug', (query) => query.eq('slug', slug))
		.unique()
	if (slugOwner && slugOwner._id !== projectId) {
		throw new ConvexError({
			code: 'PROJECT_SLUG_TAKEN',
			message: 'That slug is already used by another plugin.',
		})
	}
}

function searchTextFor(fields: {
	name: string
	summary: string
	description?: string
}) {
	return `${fields.name} ${fields.summary} ${fields.description ?? ''}`.trim()
}

async function patchProject(
	ctx: MutationCtx,
	project: Doc<'plugins'>,
	values: Partial<Omit<Doc<'plugins'>, '_id' | '_creationTime'>>,
) {
	await ctx.db.patch('plugins', project._id, values)
	const updated = await ctx.db.get('plugins', project._id)
	if (!updated) {
		throw new Error('The plugin disappeared while it was being updated.')
	}
	await replaceProjectAggregates(ctx, project, updated)
	return updated
}

// ---------------------------------------------------------------------------
// 1-3. Setup
// ---------------------------------------------------------------------------

export const createDraft = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		repositoryId: v.id('githubRepositories'),
		name: v.string(),
		slug: v.string(),
		summary: v.string(),
		description: v.optional(v.string()),
		license: v.optional(v.string()),
	},
	returns: v.id('pluginPublishingDrafts'),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const { installation } = await requireManagedRepository(
			ctx,
			args.repositoryId,
			user,
		)
		const existing = await ctx.db
			.query('pluginPublishingDrafts')
			.withIndex('by_repository_id', (query) =>
				query.eq('repositoryId', args.repositoryId),
			)
			.unique()
		// Starting again keeps what the developer already edited.
		if (existing) {
			return existing._id
		}
		const now = Date.now()
		return await ctx.db.insert('pluginPublishingDrafts', {
			ownerType: installation.ownerType,
			ownerId: installation.ownerId,
			createdBy: user._id,
			repositoryId: args.repositoryId,
			projectType: 'plugin',
			name: args.name,
			slug: args.slug,
			summary: args.summary,
			description: args.description,
			license: args.license,
			workflowPath: '.github/workflows/bedrocknexus-publish.yml',
			workflowInstalled: false,
			createdAt: now,
			updatedAt: now,
		})
	},
})

export const saveMetadata = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		name: v.string(),
		slug: v.string(),
		summary: v.string(),
		description: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingEdit', ctx.user._id)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		await assertNotUnderReview(
			ctx,
			draft,
			'The details are locked while a version is in review.',
		)
		const metadata = validatedMetadata(args)
		await assertSlugAvailable(ctx, metadata.slug, draft.projectId)

		const now = Date.now()
		await ctx.db.patch('pluginPublishingDrafts', draft._id, {
			...metadata,
			updatedAt: now,
		})
		// A published plugin keeps its public details until the next version
		// is approved, so moderators see every change before it goes live.
		const project = draft.projectId
			? await ctx.db.get('plugins', draft.projectId)
			: null
		if (project && project.status !== 'published') {
			await patchProject(ctx, project, {
				...metadata,
				searchText: searchTextFor(metadata),
				updatedAt: now,
			})
		}
		return null
	},
})

const linkArgs = {
	websiteUrl: v.optional(v.string()),
	wikiUrl: v.optional(v.string()),
	discordUrl: v.optional(v.string()),
	issuesUrl: v.optional(v.string()),
	donationUrl: v.optional(v.string()),
}

/**
 * The links on the plugin page. Unlike the other details they apply at once,
 * like project and server links.
 */
export const saveLinks = authedMutation({
	args: { draftId: v.id('pluginPublishingDrafts'), ...linkArgs },
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingEdit', ctx.user._id)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const labels = {
			websiteUrl: 'Website',
			wikiUrl: 'Wiki',
			discordUrl: 'Discord',
			issuesUrl: 'Issue tracker',
			donationUrl: 'Donation link',
		} as const
		const links: Partial<Record<keyof typeof labels, string | undefined>> = {}
		for (const field of Object.keys(labels) as (keyof typeof labels)[]) {
			try {
				assertOptionalHttpUrl(labels[field], args[field])
			} catch (error) {
				throw new ConvexError({
					code: 'INVALID_LINK',
					message:
						error instanceof Error
							? error.message
							: `${labels[field]} must be a valid URL.`,
				})
			}
			links[field] = args[field]?.trim() || undefined
		}
		await ctx.db.patch('pluginPublishingDrafts', draft._id, {
			...links,
			updatedAt: Date.now(),
		})
		if (draft.projectId) {
			await ctx.db.patch('plugins', draft.projectId, links)
		}
		return null
	},
})

const LICENSE_MAX = 80
const LICENSE_CUSTOM_MAX = 2000

/**
 * The license shown on the plugin page. It starts as the repository's license
 * on GitHub; owners can change it, and it applies at once like links.
 */
export const saveLicense = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		license: v.optional(v.string()),
		licenseCustom: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingEdit', ctx.user._id)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const license = args.license?.trim() || undefined
		const licenseCustom = args.licenseCustom?.trim() || undefined
		if (license && license.length > LICENSE_MAX) {
			throw new ConvexError({
				code: 'INVALID_LICENSE',
				message: `The license must be at most ${LICENSE_MAX} characters.`,
			})
		}
		if (licenseCustom && licenseCustom.length > LICENSE_CUSTOM_MAX) {
			throw new ConvexError({
				code: 'INVALID_LICENSE',
				message: `License notes must be at most ${LICENSE_CUSTOM_MAX} characters.`,
			})
		}
		await ctx.db.patch('pluginPublishingDrafts', draft._id, {
			license,
			licenseCustom,
			updatedAt: Date.now(),
		})
		if (draft.projectId) {
			await ctx.db.patch('plugins', draft.projectId, {
				license,
				licenseCustom,
			})
		}
		return null
	},
})

// Like Modrinth: a few categories, so each one means something.
const MAX_CATEGORIES = 3

/** The plugin's categories. They apply at once, like project categories. */
export const saveCategories = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		categoryIds: v.array(v.id('pluginCategories')),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingEdit', ctx.user._id)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const categoryIds = [...new Set(args.categoryIds)]
		if (categoryIds.length > MAX_CATEGORIES) {
			throw new ConvexError({
				code: 'TOO_MANY_CATEGORIES',
				message: `Pick at most ${MAX_CATEGORIES} categories.`,
			})
		}
		for (const categoryId of categoryIds) {
			const category = await ctx.db.get('pluginCategories', categoryId)
			if (!category?.isActive) {
				throw new ConvexError({
					code: 'CATEGORY_UNAVAILABLE',
					message: 'One of the categories is no longer available.',
				})
			}
		}
		await ctx.db.patch('pluginPublishingDrafts', draft._id, {
			categoryIds,
			updatedAt: Date.now(),
		})
		if (draft.projectId) {
			await ctx.db.patch('plugins', draft.projectId, { categoryIds })
		}
		return null
	},
})

const availableWorkflowValidator = v.object({
	key: workflowTemplateKeyValidator,
	label: v.string(),
	version: v.number(),
	softwareId: v.id('serverSoftware'),
	softwareName: v.string(),
})

export const listAvailableWorkflows = authedQuery({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.array(availableWorkflowValidator),
	handler: async (ctx, args) => {
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const project = draft.projectId
			? await ctx.db.get('plugins', draft.projectId)
			: null
		const templates = await listResolvedWorkflowTemplates(ctx)
		const available = []
		for (const template of templates) {
			const software = await ctx.db.get(
				'serverSoftware',
				template.softwareId,
			)
			if (
				!software?.enabled ||
				// A published plugin cannot move to another server software.
				(project?.status === 'published' &&
					project.softwareId !== template.softwareId)
			) {
				continue
			}
			available.push({
				key: template.key,
				label: template.label,
				version: template.version,
				softwareId: template.softwareId,
				softwareName: template.softwareName,
			})
		}
		return available
	},
})

export const selectWorkflow = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		key: workflowTemplateKeyValidator,
	},
	returns: v.id('plugins'),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingEdit', ctx.user._id)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		await assertNotUnderReview(
			ctx,
			draft,
			'The workflow is locked while a version is in review.',
		)
		const template = await resolveWorkflowTemplate(ctx, args.key)
		const software = template
			? await ctx.db.get('serverSoftware', template.softwareId)
			: null
		if (!template || !software?.enabled) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_UNAVAILABLE',
				message: 'That workflow is not available.',
			})
		}

		const now = Date.now()
		const project = draft.projectId
			? await ctx.db.get('plugins', draft.projectId)
			: null
		let projectId: Id<'plugins'>
		if (project) {
			projectId = project._id
			if (project.softwareId !== software._id) {
				if (project.status === 'published') {
					throw new ConvexError({
						code: 'SOFTWARE_CHANGE_FORBIDDEN',
						message:
							'A published plugin cannot move to another server software.',
					})
				}
				await patchProject(ctx, project, {
					softwareId: software._id,
					updatedAt: now,
				})
			}
		} else {
			// The plugin exists from here on: builds and versions belong to it.
			const metadata = validatedMetadata(draft)
			await assertSlugAvailable(ctx, metadata.slug, undefined)
			projectId = await ctx.db.insert('plugins', {
				ownerType: draft.ownerType,
				ownerId: draft.ownerId,
				createdBy: draft.createdBy,
				repositoryId: draft.repositoryId,
				softwareId: software._id,
				...metadata,
				searchText: searchTextFor(metadata),
				license: draft.license,
				iconUrl: draft.iconUrl,
				categoryIds: draft.categoryIds,
				websiteUrl: draft.websiteUrl,
				wikiUrl: draft.wikiUrl,
				discordUrl: draft.discordUrl,
				issuesUrl: draft.issuesUrl,
				donationUrl: draft.donationUrl,
				visibility: 'draft',
				status: 'draft',
				downloadCount: 0,
				downloadCounterReadyAt: now,
				ratingAverage: 0,
				ratingCount: 0,
				createdAt: now,
				updatedAt: now,
			})
			const created = await ctx.db.get('plugins', projectId)
			if (!created) {
				throw new Error('The plugin was not readable after creation.')
			}
			await insertProjectAggregates(ctx, created)
		}

		if (draft.workflowTemplateKey !== template.key) {
			await ctx.db.patch('pluginPublishingDrafts', draft._id, {
				projectId,
				softwareId: software._id,
				workflowTemplateKey: template.key,
				workflowTemplateVersion: undefined,
				workflowInstalledAt: undefined,
				workflowInstalled: false,
				updatedAt: now,
			})
		} else if (!draft.projectId) {
			await ctx.db.patch('pluginPublishingDrafts', draft._id, {
				projectId,
				softwareId: software._id,
				updatedAt: now,
			})
		}
		return projectId
	},
})

export const getActionContext = internalQuery({
	args: {
		tokenIdentifier: v.string(),
		draftId: v.id('pluginPublishingDrafts'),
	},
	returns: v.object({
		draft: publishingDraftValidator,
		repository: repositoryValidator,
		installationId: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const draft = await requireOwnedDraft(ctx, args.draftId, user)
		const { repository, installation } = await requireManagedRepository(
			ctx,
			draft.repositoryId,
			user,
		)
		return {
			draft,
			repository,
			installationId: installation.installationId,
		}
	},
})

export const recordWorkflowCommit = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		draftId: v.id('pluginPublishingDrafts'),
		branch: v.string(),
		commitSha: v.string(),
		workflowBlobSha: v.string(),
		templateKey: workflowTemplateKeyValidator,
		templateVersion: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const draft = await requireOwnedDraft(ctx, args.draftId, user)
		if (draft.workflowTemplateKey !== args.templateKey) {
			throw new ConvexError({
				code: 'WORKFLOW_SELECTION_CHANGED',
				message:
					'The selected workflow changed while it was being installed. Try again.',
			})
		}
		const now = Date.now()
		await ctx.db.patch('pluginPublishingDrafts', draft._id, {
			workflowBranch: args.branch,
			workflowCommitSha: args.commitSha,
			workflowBlobSha: args.workflowBlobSha,
			workflowTemplateVersion: args.templateVersion,
			workflowInstalledAt: now,
			workflowInstalled: true,
			updatedAt: now,
		})
		return null
	},
})

// ---------------------------------------------------------------------------
// 4. Builds
// ---------------------------------------------------------------------------

/** What actions:syncBuilds needs to read a repository's builds. */
export const getBuildSyncContext = internalQuery({
	args: { repositoryId: v.id('githubRepositories') },
	returns: v.union(
		v.object({
			draftId: v.id('pluginPublishingDrafts'),
			projectId: v.id('plugins'),
			repository: repositoryValidator,
			installationId: v.number(),
			workflowBlobSha: v.optional(v.string()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const repository = await ctx.db.get(
			'githubRepositories',
			args.repositoryId,
		)
		const draft = await ctx.db
			.query('pluginPublishingDrafts')
			.withIndex('by_repository_id', (query) =>
				query.eq('repositoryId', args.repositoryId),
			)
			.unique()
		if (
			!repository ||
			repository.accessStatus !== 'granted' ||
			!draft?.projectId ||
			!draft.workflowInstalled
		) {
			return null
		}
		const installation = await ctx.db.get(
			'githubInstallations',
			repository.installationId,
		)
		if (installation?.status !== 'active') {
			return null
		}
		return {
			draftId: draft._id,
			projectId: draft.projectId,
			repository,
			installationId: installation.installationId,
			workflowBlobSha: draft.workflowBlobSha,
		}
	},
})

/** The builds already recorded, so a sync only asks GitHub about new ones. */
export const listKnownBuilds = internalQuery({
	args: { workflowRunIds: v.array(v.number()) },
	returns: v.array(
		v.object({
			workflowRunId: v.number(),
			status: buildStatusValidator,
			artifactId: v.optional(v.number()),
			workflowBlobSha: v.optional(v.string()),
		}),
	),
	handler: async (ctx, args) => {
		const known = []
		for (const workflowRunId of args.workflowRunIds) {
			const build = await ctx.db
				.query('pluginBuilds')
				.withIndex('by_workflow_run_id', (query) =>
					query.eq('workflowRunId', workflowRunId),
				)
				.unique()
			if (build) {
				known.push({
					workflowRunId,
					status: build.status,
					artifactId: build.artifactId,
					workflowBlobSha: build.workflowBlobSha,
				})
			}
		}
		return known
	},
})

const syncedBuildValidator = v.object({
	workflowRunId: v.number(),
	workflowName: v.string(),
	event: v.string(),
	commitSha: v.string(),
	commitMessage: v.optional(v.string()),
	branch: v.optional(v.string()),
	status: buildStatusValidator,
	conclusion: v.optional(buildConclusionValidator),
	logsUrl: v.string(),
	artifactId: v.optional(v.number()),
	artifactSize: v.optional(v.number()),
	artifactExpiresAt: v.optional(v.number()),
	workflowBlobSha: v.optional(v.string()),
	createdAt: v.number(),
	completedAt: v.optional(v.number()),
})

export const upsertBuilds = internalMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		builds: v.array(syncedBuildValidator),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const draft = await ctx.db.get('pluginPublishingDrafts', args.draftId)
		if (!draft?.projectId) {
			return null
		}
		const now = Date.now()
		for (const build of args.builds) {
			// Traceable: the run used the exact workflow file BedrockNexus
			// committed, so its artifact came from the managed build.
			const traceable =
				build.status === 'completed'
					? Boolean(
							draft.workflowBlobSha &&
								build.workflowBlobSha === draft.workflowBlobSha,
						)
					: undefined
			const existing = await ctx.db
				.query('pluginBuilds')
				.withIndex('by_workflow_run_id', (query) =>
					query.eq('workflowRunId', build.workflowRunId),
				)
				.unique()
			const values = {
				...build,
				projectId: draft.projectId,
				repositoryId: draft.repositoryId,
				// Once checked, a build keeps its result even if the workflow is
				// reinstalled later.
				traceable: existing?.traceable ?? traceable,
				updatedAt: now,
			}
			if (existing) {
				await ctx.db.patch('pluginBuilds', existing._id, values)
			} else {
				await ctx.db.insert('pluginBuilds', values)
			}
		}
		await ctx.db.patch('pluginPublishingDrafts', draft._id, {
			buildsSyncedAt: now,
		})
		return null
	},
})

const BUILD_LIST_LIMIT = 30

function isPublishable(build: Doc<'pluginBuilds'>, now: number) {
	return (
		build.event === 'push' &&
		build.status === 'completed' &&
		build.conclusion === 'success' &&
		build.traceable === true &&
		build.artifactId !== undefined &&
		(build.artifactExpiresAt === undefined || build.artifactExpiresAt > now)
	)
}

function unpublishableReason(build: Doc<'pluginBuilds'>, now: number) {
	if (build.status !== 'completed') {
		return 'Still building.'
	}
	if (build.conclusion !== 'success') {
		return 'The build did not succeed.'
	}
	if (build.event !== 'push') {
		return 'Only builds of pushes can be published, not pull requests.'
	}
	if (build.traceable !== true) {
		return 'The workflow file was changed, so this build is not traceable.'
	}
	if (build.artifactId === undefined) {
		return 'The build did not upload a plugin-package artifact.'
	}
	if (build.artifactExpiresAt !== undefined && build.artifactExpiresAt <= now) {
		return 'GitHub has deleted this build’s files.'
	}
	return undefined
}

export const listBuilds = authedQuery({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		now: v.number(),
	},
	returns: v.array(
		v.object({
			buildId: v.id('pluginBuilds'),
			workflowRunId: v.number(),
			commitSha: v.string(),
			commitMessage: v.optional(v.string()),
			branch: v.optional(v.string()),
			event: v.optional(v.string()),
			status: buildStatusValidator,
			conclusion: v.optional(buildConclusionValidator),
			logsUrl: v.string(),
			artifactSize: v.optional(v.number()),
			traceable: v.optional(v.boolean()),
			publishable: v.boolean(),
			unpublishableReason: v.optional(v.string()),
			createdAt: v.number(),
			release: v.union(
				v.object({
					version: v.string(),
					status: releaseStatusValidator,
				}),
				v.null(),
			),
		}),
	),
	handler: async (ctx, args) => {
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		if (!draft.projectId) {
			return []
		}
		const builds = await ctx.db
			.query('pluginBuilds')
			.withIndex('by_project_id_and_created_at', (query) =>
				query.eq('projectId', draft.projectId as Id<'plugins'>),
			)
			.order('desc')
			.take(BUILD_LIST_LIMIT)
		return await Promise.all(
			builds.map(async (build) => {
				const releases = await ctx.db
					.query('pluginReleases')
					.withIndex('by_build_id', (query) =>
						query.eq('buildId', build._id),
					)
					.order('desc')
					.take(1)
				const release = releases[0]
				return {
					buildId: build._id,
					workflowRunId: build.workflowRunId,
					commitSha: build.commitSha,
					commitMessage: build.commitMessage,
					branch: build.branch,
					event: build.event,
					status: build.status,
					conclusion: build.conclusion,
					logsUrl: build.logsUrl,
					artifactSize: build.artifactSize,
					traceable: build.traceable,
					publishable: isPublishable(build, args.now),
					unpublishableReason: unpublishableReason(build, args.now),
					createdAt: build.createdAt,
					release: release
						? { version: release.version, status: release.status }
						: null,
				}
			}),
		)
	},
})

// ---------------------------------------------------------------------------
// 5. Sending a build to review
// ---------------------------------------------------------------------------

export const submitRelease = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		buildId: v.id('pluginBuilds'),
		version: v.string(),
		changelog: v.string(),
	},
	returns: v.id('pluginReleases'),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingSubmit', ctx.user._id)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const project = draft.projectId
			? await ctx.db.get('plugins', draft.projectId)
			: null
		if (!project || !draft.workflowInstalled) {
			throw new ConvexError({
				code: 'PUBLICATION_NOT_READY',
				message: 'Install the workflow before sending a build to review.',
			})
		}
		if (draft.rejectedAt && project.status !== 'published') {
			throw new ConvexError({
				code: 'SUBMISSION_REJECTED',
				message:
					'This plugin was rejected by a moderator and cannot be sent again.',
			})
		}
		if (
			project.visibility === 'hidden' ||
			project.visibility === 'suspended'
		) {
			throw new ConvexError({
				code: 'PUBLICATION_BLOCKED',
				message: 'This plugin cannot currently be published.',
			})
		}
		await requireManagedRepository(ctx, draft.repositoryId, ctx.user)
		if (await activeReleaseFor(ctx, project._id)) {
			throw new ConvexError({
				code: 'ALREADY_IN_REVIEW',
				message:
					'Another version is already in review. Wait for the moderator’s decision.',
			})
		}

		const build = await ctx.db.get('pluginBuilds', args.buildId)
		const now = Date.now()
		if (!build || build.projectId !== project._id) {
			throw new ConvexError({
				code: 'BUILD_NOT_FOUND',
				message: 'That build was not found.',
			})
		}
		if (!isPublishable(build, now)) {
			throw new ConvexError({
				code: 'BUILD_NOT_PUBLISHABLE',
				message:
					unpublishableReason(build, now) ??
					'That build cannot be published.',
			})
		}

		const buildReleases = await ctx.db
			.query('pluginReleases')
			.withIndex('by_build_id', (query) => query.eq('buildId', build._id))
			.take(20)
		if (
			buildReleases.some(
				(release) => !REUSABLE_BUILD_STATUSES.has(release.status),
			)
		) {
			throw new ConvexError({
				code: 'BUILD_ALREADY_USED',
				message: 'This build was already published, rejected, or is in review.',
			})
		}

		const parsed = releaseSubmissionSchema.safeParse({
			version: args.version,
			changelog: args.changelog,
		})
		if (!parsed.success) {
			throw new ConvexError({
				code: 'INVALID_RELEASE',
				message:
					parsed.error.issues[0]?.message ?? 'The version is invalid.',
			})
		}
		const { version, changelog } = parsed.data
		const sameVersion = await ctx.db
			.query('pluginReleases')
			.withIndex('by_project_id_and_normalized_version', (query) =>
				query.eq('projectId', project._id).eq('normalizedVersion', version),
			)
			.take(20)
		if (
			sameVersion.some(
				(release) => !REUSABLE_VERSION_STATUSES.has(release.status),
			)
		) {
			throw new ConvexError({
				code: 'VERSION_TAKEN',
				message: `Version ${version} is already used. Published versions are never replaced.`,
			})
		}

		const releaseId = await ctx.db.insert('pluginReleases', {
			projectId: project._id,
			repositoryId: draft.repositoryId,
			buildId: build._id,
			version,
			normalizedVersion: version,
			changelog,
			commitSha: build.commitSha,
			branch: build.branch,
			traceable: true,
			status: 'preparing',
			submittedBy: ctx.user._id,
			submittedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		if (project.status !== 'published') {
			await patchProject(ctx, project, {
				visibility: 'draft',
				status: 'review',
				updatedAt: now,
			})
		}
		await ctx.scheduler.runAfter(
			0,
			internal.functions.plugins.publishing.actions.prepareRelease,
			{ releaseId },
		)
		return releaseId
	},
})

const releaseActionContextValidator = v.object({
	release: v.object({
		_id: v.id('pluginReleases'),
		status: releaseStatusValidator,
		version: v.string(),
		changelog: v.string(),
		commitSha: v.string(),
		fileName: v.optional(v.string()),
		sha256: v.optional(v.string()),
		uploadKey: v.optional(v.string()),
		cdnKey: v.optional(v.string()),
		githubReleaseId: v.optional(v.number()),
	}),
	projectId: v.id('plugins'),
	projectName: v.string(),
	projectSlug: v.string(),
	artifactId: v.optional(v.number()),
	artifactSize: v.optional(v.number()),
	repository: repositoryValidator,
	installationId: v.union(v.number(), v.null()),
})

/** Everything the release actions need, without user context. */
export const getReleaseActionContext = internalQuery({
	args: { releaseId: v.id('pluginReleases') },
	returns: v.union(releaseActionContextValidator, v.null()),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (!release) {
			return null
		}
		const [project, build, repository] = await Promise.all([
			ctx.db.get('plugins', release.projectId),
			ctx.db.get('pluginBuilds', release.buildId),
			ctx.db.get('githubRepositories', release.repositoryId),
		])
		if (!project || !repository) {
			return null
		}
		const installation = await ctx.db.get(
			'githubInstallations',
			repository.installationId,
		)
		return {
			release: {
				_id: release._id,
				status: release.status,
				version: release.version,
				changelog: release.changelog,
				commitSha: release.commitSha,
				fileName: release.fileName,
				sha256: release.sha256,
				uploadKey: release.uploadKey,
				cdnKey: release.cdnKey,
				githubReleaseId: release.githubReleaseId,
			},
			projectId: project._id,
			projectName: project.name,
			projectSlug: project.slug,
			artifactId: build?.artifactId,
			artifactSize: build?.artifactSize,
			repository,
			installationId:
				installation?.status === 'active'
					? installation.installationId
					: null,
		}
	},
})

export const finishPreparation = internalMutation({
	args: {
		releaseId: v.id('pluginReleases'),
		fileName: v.string(),
		size: v.number(),
		sha256: v.string(),
		uploadKey: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (release?.status !== 'preparing') {
			// The copy is orphaned; actions:prepareRelease deletes it.
			return false
		}
		await ctx.db.patch('pluginReleases', release._id, {
			status: 'inReview',
			fileName: args.fileName,
			size: args.size,
			sha256: args.sha256,
			uploadKey: args.uploadKey,
			failureReason: undefined,
			updatedAt: Date.now(),
		})
		return true
	},
})

export const failPreparation = internalMutation({
	args: { releaseId: v.id('pluginReleases'), reason: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (release?.status !== 'preparing') {
			return null
		}
		const now = Date.now()
		await ctx.db.patch('pluginReleases', release._id, {
			status: 'preparationFailed',
			failureReason: args.reason,
			updatedAt: now,
		})
		const project = await ctx.db.get('plugins', release.projectId)
		if (project?.status === 'review') {
			await patchProject(ctx, project, { status: 'draft', updatedAt: now })
		}
		return null
	},
})

const developerReleaseValidator = v.object({
	releaseId: v.id('pluginReleases'),
	version: v.string(),
	changelog: v.string(),
	commitSha: v.string(),
	branch: v.optional(v.string()),
	status: releaseStatusValidator,
	failureReason: v.optional(v.string()),
	fileName: v.optional(v.string()),
	size: v.optional(v.number()),
	sha256: v.optional(v.string()),
	reviewNotes: v.optional(v.string()),
	githubReleaseStatus: v.optional(githubReleaseStatusValidator),
	githubReleaseUrl: v.optional(v.string()),
	githubReleaseError: v.optional(v.string()),
	submittedAt: v.number(),
	publishedAt: v.optional(v.number()),
})

function toDeveloperRelease(release: Doc<'pluginReleases'>) {
	return {
		releaseId: release._id,
		version: release.version,
		changelog: release.changelog,
		commitSha: release.commitSha,
		branch: release.branch,
		status: release.status,
		failureReason: release.failureReason,
		fileName: release.fileName,
		size: release.size,
		sha256: release.sha256,
		reviewNotes: release.reviewNotes,
		githubReleaseStatus: release.githubReleaseStatus,
		githubReleaseUrl: release.githubReleaseUrl,
		githubReleaseError: release.githubReleaseError,
		submittedAt: release.submittedAt,
		publishedAt: release.publishedAt,
	}
}

export const listReleases = authedQuery({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.array(developerReleaseValidator),
	handler: async (ctx, args) => {
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		if (!draft.projectId) {
			return []
		}
		const releases = await ctx.db
			.query('pluginReleases')
			.withIndex('by_project_id', (query) =>
				query.eq('projectId', draft.projectId as Id<'plugins'>),
			)
			.order('desc')
			.take(50)
		return releases.map(toDeveloperRelease)
	},
})

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

/** Moderators may not approve plugins they created or belong to. */
async function assertNotOwnSubmission(
	ctx: MutationCtx,
	project: Doc<'plugins'>,
	release: Doc<'pluginReleases'>,
	user: AppUser,
) {
	const ownsProject =
		project.createdBy === user._id ||
		release.submittedBy === user._id ||
		(project.ownerType === 'user'
			? project.ownerId === user._id
			: Boolean(
					await getActiveOrganizationMembership(
						ctx,
						project.ownerId,
						user,
					),
				))
	if (ownsProject) {
		throw new ConvexError({
			code: 'SELF_REVIEW_FORBIDDEN',
			message:
				'You cannot approve your own submission. Ask another moderator to review it.',
		})
	}
}

export const listReviewQueue = adminQuery({
	args: {},
	returns: v.array(
		v.object({
			releaseId: v.id('pluginReleases'),
			status: releaseStatusValidator,
			version: v.string(),
			changelog: v.string(),
			commitSha: v.string(),
			branch: v.optional(v.string()),
			fileName: v.optional(v.string()),
			size: v.optional(v.number()),
			sha256: v.optional(v.string()),
			failureReason: v.optional(v.string()),
			submittedAt: v.number(),
			logsUrl: v.optional(v.string()),
			firstRelease: v.boolean(),
			projectName: v.string(),
			projectSlug: v.string(),
			summary: v.string(),
			softwareName: v.string(),
			repository: repositoryValidator,
		}),
	),
	handler: async (ctx) => {
		const [inReview, publishing] = await Promise.all([
			ctx.db
				.query('pluginReleases')
				.withIndex('by_status_and_submitted_at', (query) =>
					query.eq('status', 'inReview'),
				)
				.order('asc')
				.take(100),
			ctx.db
				.query('pluginReleases')
				.withIndex('by_status_and_submitted_at', (query) =>
					query.eq('status', 'publishing'),
				)
				.order('asc')
				.take(20),
		])
		const result = []
		for (const release of [...publishing, ...inReview]) {
			const [project, repository, build] = await Promise.all([
				ctx.db.get('plugins', release.projectId),
				ctx.db.get('githubRepositories', release.repositoryId),
				ctx.db.get('pluginBuilds', release.buildId),
			])
			if (!project || !repository) {
				continue
			}
			const [software, draft] = await Promise.all([
				ctx.db.get('serverSoftware', project.softwareId),
				ctx.db
					.query('pluginPublishingDrafts')
					.withIndex('by_project_id', (query) =>
						query.eq('projectId', project._id),
					)
					.first(),
			])
			result.push({
				releaseId: release._id,
				status: release.status,
				version: release.version,
				changelog: release.changelog,
				commitSha: release.commitSha,
				branch: release.branch,
				fileName: release.fileName,
				size: release.size,
				sha256: release.sha256,
				failureReason: release.failureReason,
				submittedAt: release.submittedAt,
				logsUrl: build?.logsUrl,
				firstRelease: project.status !== 'published',
				// Moderators review the details that approval will publish.
				projectName: draft?.name ?? project.name,
				projectSlug: draft?.slug ?? project.slug,
				summary: draft?.summary ?? project.summary,
				softwareName: software?.name ?? 'Unknown software',
				repository,
			})
		}
		return result
	},
})

/** The private copy of a release in review, for actions:getReviewDownloadUrl. */
export const getReviewFile = internalQuery({
	args: { tokenIdentifier: v.string(), releaseId: v.id('pluginReleases') },
	returns: v.union(
		v.object({ uploadKey: v.string(), fileName: v.string() }),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		if (!isStaff(user)) {
			throw new ConvexError({
				code: 'FORBIDDEN',
				message: 'Admin role required.',
			})
		}
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		return release?.uploadKey && release.fileName
			? { uploadKey: release.uploadKey, fileName: release.fileName }
			: null
	},
})

export const approveReview = adminMutation({
	args: {
		releaseId: v.id('pluginReleases'),
		note: v.optional(v.string()),
	},
	returns: v.id('plugins'),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'moderationDecision', ctx.admin._id)
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (release?.status !== 'inReview' || !release.uploadKey) {
			throw new ConvexError({
				code: 'REVIEW_NOT_PENDING',
				message: 'This version is not waiting for review.',
			})
		}
		const project = await ctx.db.get('plugins', release.projectId)
		if (
			!project ||
			project.visibility === 'hidden' ||
			project.visibility === 'suspended'
		) {
			throw new ConvexError({
				code: 'PUBLICATION_BLOCKED',
				message: 'This plugin cannot currently be published.',
			})
		}
		await assertNotOwnSubmission(ctx, project, release, ctx.admin)
		const repository = await ctx.db.get(
			'githubRepositories',
			release.repositoryId,
		)
		if (
			!repository ||
			repository.isPrivate ||
			repository.accessStatus !== 'granted'
		) {
			throw new ConvexError({
				code: 'REPOSITORY_INELIGIBLE',
				message: 'The repository is no longer eligible for publishing.',
			})
		}
		const now = Date.now()
		const note = args.note?.trim() || undefined
		await ctx.db.patch('pluginReleases', release._id, {
			status: 'publishing',
			reviewedAt: now,
			reviewedBy: ctx.admin._id,
			reviewNotes: note,
			failureReason: undefined,
			updatedAt: now,
		})
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'plugin.approve',
			targetType: 'pluginRelease',
			targetId: release._id,
			targetLabel: `${project.name} ${release.version}`,
			changes: { previousState: 'inReview', resultingState: 'publishing' },
			reason: note ?? 'Version approved for publication.',
		})
		await ctx.scheduler.runAfter(
			0,
			internal.functions.plugins.publishing.actions.publishRelease,
			{ releaseId: release._id },
		)
		return project._id
	},
})

/** Retries copying an approved version to the CDN after a failure. */
export const retryPublishing = adminMutation({
	args: { releaseId: v.id('pluginReleases') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (release?.status !== 'publishing') {
			throw new ConvexError({
				code: 'RELEASE_NOT_PUBLISHING',
				message: 'This version is not waiting to be published.',
			})
		}
		await ctx.db.patch('pluginReleases', release._id, {
			failureReason: undefined,
			updatedAt: Date.now(),
		})
		await ctx.scheduler.runAfter(
			0,
			internal.functions.plugins.publishing.actions.publishRelease,
			{ releaseId: release._id },
		)
		return null
	},
})

export const recordPublishingError = internalMutation({
	args: { releaseId: v.id('pluginReleases'), reason: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (release?.status === 'publishing') {
			await ctx.db.patch('pluginReleases', release._id, {
				failureReason: args.reason,
				updatedAt: Date.now(),
			})
		}
		return null
	},
})

/** Makes an approved version live once its file is on the CDN. */
export const finishPublishing = internalMutation({
	args: { releaseId: v.id('pluginReleases'), cdnKey: v.string() },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (release?.status !== 'publishing') {
			return false
		}
		const project = await ctx.db.get('plugins', release.projectId)
		if (!project) {
			return false
		}
		const now = Date.now()
		const versionId = await ctx.db.insert('pluginVersions', {
			projectId: project._id,
			version: release.version,
			normalizedVersion: release.normalizedVersion,
			changelog: release.changelog,
			status: 'published',
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		await ctx.db.patch('pluginReleases', release._id, {
			status: 'published',
			versionId,
			cdnKey: args.cdnKey,
			failureReason: undefined,
			publishedAt: now,
			githubReleaseStatus: 'pending',
			updatedAt: now,
		})

		// Approving a build older than the current latest version must not
		// move "latest" backwards.
		let isNewest = true
		if (project.latestVersionId) {
			const latest = await ctx.db
				.query('pluginReleases')
				.withIndex('by_version_id', (query) =>
					query.eq(
						'versionId',
						project.latestVersionId as Id<'pluginVersions'>,
					),
				)
				.first()
			const [latestBuild, build] = await Promise.all([
				latest ? ctx.db.get('pluginBuilds', latest.buildId) : null,
				ctx.db.get('pluginBuilds', release.buildId),
			])
			isNewest =
				!latestBuild || !build || build.createdAt >= latestBuild.createdAt
		}
		const draft = await ctx.db
			.query('pluginPublishingDrafts')
			.withIndex('by_project_id', (query) =>
				query.eq('projectId', project._id),
			)
			.first()
		const details = draft
			? {
					slug: draft.slug,
					name: draft.name,
					summary: draft.summary,
					description: draft.description,
					license: draft.license,
					licenseCustom: draft.licenseCustom,
					iconUrl: draft.iconUrl,
					searchText: searchTextFor(draft),
				}
			: {}
		// The icon the approved details replace is no longer shown anywhere.
		if (draft && project.iconUrl && project.iconUrl !== draft.iconUrl) {
			await deleteIcon(ctx, draft._id, project.iconUrl)
		}
		await patchProject(ctx, project, {
			...(isNewest ? { latestVersionId: versionId } : {}),
			...details,
			visibility: 'public',
			status: 'published',
			publishedAt: project.publishedAt ?? now,
			updatedAt: now,
		})
		await ctx.scheduler.runAfter(
			0,
			internal.functions.plugins.publishing.actions.createGitHubRelease,
			{ releaseId: release._id },
		)
		return true
	},
})

export const recordGitHubRelease = internalMutation({
	args: {
		releaseId: v.id('pluginReleases'),
		status: v.union(v.literal('created'), v.literal('failed')),
		githubReleaseId: v.optional(v.number()),
		url: v.optional(v.string()),
		error: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (!release) {
			return null
		}
		await ctx.db.patch('pluginReleases', release._id, {
			githubReleaseStatus: args.status,
			githubReleaseId: args.githubReleaseId ?? release.githubReleaseId,
			githubReleaseUrl: args.url ?? release.githubReleaseUrl,
			githubReleaseError: args.error,
			updatedAt: Date.now(),
		})
		return null
	},
})

/** The developer retries a GitHub release that failed. */
export const retryGitHubRelease = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		releaseId: v.id('pluginReleases'),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingEdit', ctx.user._id)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (
			!release ||
			release.projectId !== draft.projectId ||
			release.status !== 'published' ||
			release.githubReleaseStatus !== 'failed'
		) {
			throw new ConvexError({
				code: 'GITHUB_RELEASE_NOT_RETRYABLE',
				message: 'This GitHub release cannot be retried.',
			})
		}
		await ctx.db.patch('pluginReleases', release._id, {
			githubReleaseStatus: 'pending',
			githubReleaseError: undefined,
			updatedAt: Date.now(),
		})
		await ctx.scheduler.runAfter(
			0,
			internal.functions.plugins.publishing.actions.createGitHubRelease,
			{ releaseId: release._id },
		)
		return null
	},
})

/** Clears the private copy's key once actions:deleteReviewFile removed it. */
export const clearUploadKey = internalMutation({
	args: { releaseId: v.id('pluginReleases'), uploadKey: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const release = await ctx.db.get('pluginReleases', args.releaseId)
		if (release?.uploadKey === args.uploadKey) {
			await ctx.db.patch('pluginReleases', release._id, {
				uploadKey: undefined,
			})
		}
		return null
	},
})

const reviewDecisionArgs = {
	releaseId: v.id('pluginReleases'),
	reason: v.string(),
}

async function recordReviewDecision(
	ctx: MutationCtx & { admin: AppUser },
	args: { releaseId: Id<'pluginReleases'>; reason: string },
	status: 'changesRequested' | 'rejected',
) {
	await enforceRateLimit(ctx, 'moderationDecision', ctx.admin._id)
	const reason = args.reason.trim()
	if (!reason) {
		throw new ConvexError({
			code: 'REASON_REQUIRED',
			message: 'A review reason is required.',
		})
	}
	const release = await ctx.db.get('pluginReleases', args.releaseId)
	if (release?.status !== 'inReview') {
		throw new ConvexError({
			code: 'REVIEW_NOT_PENDING',
			message: 'This version is not waiting for review.',
		})
	}
	const project = await ctx.db.get('plugins', release.projectId)
	if (!project) {
		throw new ConvexError({
			code: 'PROJECT_NOT_FOUND',
			message: 'Plugin not found.',
		})
	}
	const now = Date.now()
	await ctx.db.patch('pluginReleases', release._id, {
		status,
		reviewedAt: now,
		reviewedBy: ctx.admin._id,
		reviewNotes: reason,
		updatedAt: now,
	})
	if (project.status !== 'published') {
		await patchProject(ctx, project, {
			visibility: 'draft',
			status: 'draft',
			updatedAt: now,
		})
		if (status === 'rejected') {
			const draft = await ctx.db
				.query('pluginPublishingDrafts')
				.withIndex('by_project_id', (query) =>
					query.eq('projectId', project._id),
				)
				.first()
			if (draft) {
				await ctx.db.patch('pluginPublishingDrafts', draft._id, {
					rejectedAt: now,
				})
			}
		}
	}
	if (release.uploadKey) {
		await ctx.scheduler.runAfter(
			0,
			internal.functions.plugins.publishing.actions.deleteReviewFile,
			{ releaseId: release._id, uploadKey: release.uploadKey },
		)
	}
	await recordAdminAction(ctx, ctx.admin._id, {
		action: status === 'rejected' ? 'plugin.reject' : 'plugin.requestChanges',
		targetType: 'pluginRelease',
		targetId: release._id,
		targetLabel: `${project.name} ${release.version}`,
		changes: { previousState: 'inReview', resultingState: status },
		reason,
	})
	return project._id
}

export const requestReviewChanges = adminMutation({
	args: reviewDecisionArgs,
	returns: v.id('plugins'),
	handler: async (ctx, args) =>
		await recordReviewDecision(ctx, args, 'changesRequested'),
})

export const rejectReview = adminMutation({
	args: reviewDecisionArgs,
	returns: v.id('plugins'),
	handler: async (ctx, args) =>
		await recordReviewDecision(ctx, args, 'rejected'),
})

// ---------------------------------------------------------------------------
// The developer's plugins
// ---------------------------------------------------------------------------

export const draftStageValidator = v.union(
	v.literal('setup'),
	v.literal('building'),
	releaseStatusValidator,
)

async function stageOf(
	ctx: QueryCtx,
	draft: Doc<'pluginPublishingDrafts'>,
): Promise<{
	stage: typeof draftStageValidator.type
	latestVersion: string | undefined
}> {
	if (!draft.projectId) {
		return { stage: 'setup', latestVersion: undefined }
	}
	const [latestRelease] = await ctx.db
		.query('pluginReleases')
		.withIndex('by_project_id', (query) =>
			query.eq('projectId', draft.projectId as Id<'plugins'>),
		)
		.order('desc')
		.take(1)
	if (latestRelease) {
		return {
			stage: latestRelease.status,
			latestVersion: latestRelease.version,
		}
	}
	return {
		stage: draft.workflowInstalled ? 'building' : 'setup',
		latestVersion: undefined,
	}
}

export const listMine = authedQuery({
	args: {},
	returns: v.array(
		v.object({
			draft: publishingDraftValidator,
			repository: repositoryValidator,
			stage: draftStageValidator,
			latestVersion: v.optional(v.string()),
		}),
	),
	handler: async (ctx) => {
		const personalDrafts = await ctx.db
			.query('pluginPublishingDrafts')
			.withIndex('by_owner_type_and_owner_id', (query) =>
				query.eq('ownerType', 'user').eq('ownerId', ctx.user._id),
			)
			.order('desc')
			.take(20)
		const memberships = await listOrganizationMemberships(ctx, ctx.user._id)
		const organizationDrafts = (
			await Promise.all(
				memberships.map((membership) =>
					ctx.db
						.query('pluginPublishingDrafts')
						.withIndex('by_owner_type_and_owner_id', (query) =>
							query
								.eq('ownerType', 'organization')
								.eq('ownerId', membership.organizationId),
						)
						.order('desc')
						.take(20),
				),
			)
		).flat()
		const drafts = [
			...new Map(
				[...personalDrafts, ...organizationDrafts].map((draft) => [
					draft._id,
					draft,
				]),
			).values(),
		]
		const result = []
		for (const draft of drafts) {
			const repository = await ctx.db.get(
				'githubRepositories',
				draft.repositoryId,
			)
			if (repository) {
				result.push({
					draft,
					repository,
					...(await stageOf(ctx, draft)),
				})
			}
		}
		return result
	},
})

export const getMine = authedQuery({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.object({
		draft: publishingDraftValidator,
		repository: repositoryValidator,
		project: v.union(
			v.object({
				status: v.string(),
				visibility: v.string(),
				slug: v.string(),
			}),
			v.null(),
		),
		softwareName: v.optional(v.string()),
		locked: v.boolean(),
		// The moderator's note when the latest version was sent back.
		moderationNote: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const repository = await ctx.db.get(
			'githubRepositories',
			draft.repositoryId,
		)
		if (!repository) {
			throw new ConvexError({
				code: 'REPOSITORY_NOT_FOUND',
				message: 'The plugin repository no longer exists.',
			})
		}
		const project = draft.projectId
			? await ctx.db.get('plugins', draft.projectId)
			: null
		const software = draft.softwareId
			? await ctx.db.get('serverSoftware', draft.softwareId)
			: null
		const latestRelease = project
			? await ctx.db
					.query('pluginReleases')
					.withIndex('by_project_id', (query) =>
						query.eq('projectId', project._id),
					)
					.order('desc')
					.first()
			: null
		return {
			draft,
			repository,
			project: project
				? {
						status: project.status,
						visibility: project.visibility,
						slug: project.slug,
					}
				: null,
			softwareName: software?.name,
			locked: project ? Boolean(await activeReleaseFor(ctx, project._id)) : false,
			moderationNote:
				latestRelease?.status === 'changesRequested' ||
				latestRelease?.status === 'rejected'
					? latestRelease.reviewNotes
					: undefined,
		}
	},
})

export const resolveMine = authedQuery({
	args: { reference: v.string() },
	returns: v.union(v.id('pluginPublishingDrafts'), v.null()),
	handler: async (ctx, args) => {
		const githubRepositoryId = parsePluginDashboardId(args.reference)
		let draftId: Id<'pluginPublishingDrafts'> | null = null

		if (githubRepositoryId !== null) {
			const repository = await ctx.db
				.query('githubRepositories')
				.withIndex('by_github_repository_id', (query) =>
					query.eq('githubRepositoryId', githubRepositoryId),
				)
				.unique()
			if (repository) {
				const draft = await ctx.db
					.query('pluginPublishingDrafts')
					.withIndex('by_repository_id', (query) =>
						query.eq('repositoryId', repository._id),
					)
					.unique()
				draftId = draft?._id ?? null
			}
		} else {
			draftId = ctx.db.normalizeId(
				'pluginPublishingDrafts',
				args.reference,
			)
		}

		if (!draftId) {
			return null
		}
		await requireOwnedDraft(ctx, draftId, ctx.user)
		return draftId
	},
})
