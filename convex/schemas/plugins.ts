import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const organizationRoleValidator = v.union(
	v.literal('owner'),
	v.literal('admin'),
	v.literal('member'),
)

export const ownerTypeValidator = v.union(
	v.literal('user'),
	v.literal('organization'),
)

export const projectVisibilityValidator = v.union(
	v.literal('draft'),
	v.literal('unlisted'),
	v.literal('public'),
	v.literal('hidden'),
	v.literal('suspended'),
)

export const projectStatusValidator = v.union(
	v.literal('draft'),
	v.literal('review'),
	v.literal('published'),
	v.literal('archived'),
)

const webhookDeliveryCommonValidator = v.object({
	deliveryId: v.string(),
	event: v.string(),
	action: v.optional(v.string()),
	installationId: v.optional(v.id('githubInstallations')),
	repositoryId: v.optional(v.id('githubRepositories')),
	attemptCount: v.number(),
	payloadDigest: v.string(),
	receivedAt: v.number(),
})

export const webhookDeliveryValidator = v.union(
	webhookDeliveryCommonValidator.extend({
		status: v.literal('processing'),
	}),
	webhookDeliveryCommonValidator.extend({
		status: v.literal('processed'),
		completedAt: v.number(),
	}),
	webhookDeliveryCommonValidator.extend({
		status: v.literal('ignored'),
		completedAt: v.number(),
	}),
	webhookDeliveryCommonValidator.extend({
		status: v.literal('failed'),
		lastError: v.string(),
		completedAt: v.number(),
	}),
)

const webhookDeliveryAttemptCommonValidator = v.object({
	webhookDeliveryId: v.id('githubWebhookDeliveries'),
	attemptNumber: v.number(),
	startedAt: v.number(),
})

export const webhookDeliveryAttemptValidator = v.union(
	webhookDeliveryAttemptCommonValidator.extend({
		status: v.literal('processing'),
	}),
	webhookDeliveryAttemptCommonValidator.extend({
		status: v.literal('processed'),
		completedAt: v.number(),
	}),
	webhookDeliveryAttemptCommonValidator.extend({
		status: v.literal('ignored'),
		completedAt: v.number(),
	}),
	webhookDeliveryAttemptCommonValidator.extend({
		status: v.literal('duplicate'),
		completedAt: v.number(),
	}),
	webhookDeliveryAttemptCommonValidator.extend({
		status: v.literal('failed'),
		error: v.string(),
		completedAt: v.number(),
	}),
)

export const workflowTemplateKeyValidator = v.string()

/**
 * One per repository: the plugin's setup. A draft starts from the repository
 * (name, description, README); the workflow the developer picks decides the
 * server software. The plugin row is created once both are known.
 */
const draftFields = {
	ownerType: ownerTypeValidator,
	ownerId: v.string(),
	createdBy: v.string(),
	repositoryId: v.id('githubRepositories'),
	projectId: v.optional(v.id('plugins')),
	// Set with the workflow template.
	softwareId: v.optional(v.id('serverSoftware')),
	projectType: v.literal('plugin'),
	name: v.string(),
	slug: v.string(),
	summary: v.string(),
	description: v.optional(v.string()),
	license: v.optional(v.string()),
	// CDN URL of the plugin's icon (functions/plugins/icons.ts).
	iconUrl: v.optional(v.string()),
	// Links shown on the plugin page (functions/plugins/publishing/model:saveLinks).
	// Source code is always the repository; issues default to its issue tracker.
	websiteUrl: v.optional(v.string()),
	wikiUrl: v.optional(v.string()),
	discordUrl: v.optional(v.string()),
	issuesUrl: v.optional(v.string()),
	donationUrl: v.optional(v.string()),
	workflowPath: v.string(),
	workflowBranch: v.optional(v.string()),
	workflowCommitSha: v.optional(v.string()),
	// Git blob SHA of the managed workflow file BedrockNexus installed.
	workflowBlobSha: v.optional(v.string()),
	workflowTemplateKey: v.optional(v.string()),
	workflowTemplateVersion: v.optional(v.number()),
	workflowInstalledAt: v.optional(v.number()),
	workflowInstalled: v.boolean(),
	buildsSyncedAt: v.optional(v.number()),
	// A rejected first submission is final for a plugin that was never published.
	rejectedAt: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
}

export const publishingDraftValidator = v.object({
	_id: v.id('pluginPublishingDrafts'),
	_creationTime: v.number(),
	...draftFields,
})

export const buildStatusValidator = v.union(
	v.literal('queued'),
	v.literal('inProgress'),
	v.literal('completed'),
)

export const buildConclusionValidator = v.union(
	v.literal('success'),
	v.literal('failure'),
	v.literal('cancelled'),
	v.literal('skipped'),
	v.literal('timedOut'),
	v.literal('actionRequired'),
)

export const releaseStatusValidator = v.union(
	// Copying the build from GitHub into private storage.
	v.literal('preparing'),
	v.literal('preparationFailed'),
	v.literal('inReview'),
	v.literal('changesRequested'),
	v.literal('rejected'),
	// Approved; copying the file to the public CDN.
	v.literal('publishing'),
	v.literal('published'),
)

export const githubReleaseStatusValidator = v.union(
	v.literal('pending'),
	v.literal('created'),
	v.literal('failed'),
)

export const githubInstallationValidator = v.object({
	_id: v.id('githubInstallations'),
	_creationTime: v.number(),
	installationId: v.number(),
	accountId: v.number(),
	accountLogin: v.string(),
	accountType: v.union(v.literal('User'), v.literal('Organization')),
	accountAvatarUrl: v.optional(v.string()),
	ownerType: ownerTypeValidator,
	ownerId: v.string(),
	connectedBy: v.string(),
	repositorySelection: v.optional(
		v.union(v.literal('all'), v.literal('selected')),
	),
	status: v.union(
		v.literal('active'),
		v.literal('suspended'),
		v.literal('deleted'),
	),
	suspendedAt: v.optional(v.number()),
	syncStartedAt: v.optional(v.number()),
	lastSyncAt: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
})

export const repositoryValidator = v.object({
	_id: v.id('githubRepositories'),
	_creationTime: v.number(),
	installationId: v.id('githubInstallations'),
	githubRepositoryId: v.number(),
	ownerLogin: v.string(),
	name: v.string(),
	fullName: v.string(),
	description: v.optional(v.string()),
	htmlUrl: v.string(),
	defaultBranch: v.string(),
	isPrivate: v.boolean(),
	isArchived: v.boolean(),
	accessStatus: v.union(
		v.literal('granted'),
		v.literal('removed'),
		v.literal('ineligible'),
	),
	githubUpdatedAt: v.optional(v.number()),
	pushedAt: v.optional(v.number()),
	lastSeenAt: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
})

export const projectValidator = v.object({
	_id: v.id('plugins'),
	_creationTime: v.number(),
	ownerType: ownerTypeValidator,
	ownerId: v.string(),
	createdBy: v.string(),
	repositoryId: v.id('githubRepositories'),
	softwareId: v.id('serverSoftware'),
	slug: v.string(),
	name: v.string(),
	summary: v.string(),
	description: v.optional(v.string()),
	searchText: v.string(),
	license: v.optional(v.string()),
	iconUrl: v.optional(v.string()),
	// Links shown on the plugin page (functions/plugins/publishing/model:saveLinks).
	// Source code is always the repository; issues default to its issue tracker.
	websiteUrl: v.optional(v.string()),
	wikiUrl: v.optional(v.string()),
	discordUrl: v.optional(v.string()),
	issuesUrl: v.optional(v.string()),
	donationUrl: v.optional(v.string()),
	visibility: projectVisibilityValidator,
	status: projectStatusValidator,
	latestVersionId: v.optional(v.id('pluginVersions')),
	downloadCount: v.number(),
	downloadCounterReadyAt: v.optional(v.number()),
	downloadCountRefreshScheduledAt: v.optional(v.number()),
	ratingAverage: v.number(),
	ratingCount: v.number(),
	publishedAt: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
})

export const tables = {
	githubInstallations: defineTable({
		installationId: v.number(),
		accountId: v.number(),
		accountLogin: v.string(),
		accountType: v.union(v.literal('User'), v.literal('Organization')),
		accountAvatarUrl: v.optional(v.string()),
		ownerType: ownerTypeValidator,
		ownerId: v.string(),
		connectedBy: v.string(),
		repositorySelection: v.optional(
			v.union(v.literal('all'), v.literal('selected')),
		),
		status: v.union(
			v.literal('active'),
			v.literal('suspended'),
			v.literal('deleted'),
		),
		suspendedAt: v.optional(v.number()),
		syncStartedAt: v.optional(v.number()),
		lastSyncAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_installation_id', ['installationId'])
		.index('by_owner_type_and_owner_id', ['ownerType', 'ownerId'])
		.index('by_account_id', ['accountId']),

	githubRepositories: defineTable({
		installationId: v.id('githubInstallations'),
		githubRepositoryId: v.number(),
		ownerLogin: v.string(),
		name: v.string(),
		fullName: v.string(),
		description: v.optional(v.string()),
		htmlUrl: v.string(),
		defaultBranch: v.string(),
		isPrivate: v.boolean(),
		isArchived: v.boolean(),
		accessStatus: v.union(
			v.literal('granted'),
			v.literal('removed'),
			v.literal('ineligible'),
		),
		githubUpdatedAt: v.optional(v.number()),
		pushedAt: v.optional(v.number()),
		lastSeenAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_github_repository_id', ['githubRepositoryId'])
		.index('by_installation_id', ['installationId'])
		.index('by_installation_id_and_access_status', [
			'installationId',
			'accessStatus',
		])
		.index('by_full_name', ['fullName']),

	pluginPublishingDrafts: defineTable(draftFields)
		.index('by_owner_type_and_owner_id', ['ownerType', 'ownerId'])
		.index('by_repository_id', ['repositoryId'])
		.index('by_project_id', ['projectId'])
		.index('by_workflow_template_key', ['workflowTemplateKey']),

	pluginWorkflowTemplates: defineTable({
		key: workflowTemplateKeyValidator,
		softwareId: v.id('serverSoftware'),
		label: v.optional(v.string()),
		content: v.string(),
		version: v.number(),
		updatedBy: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_key', ['key'])
		.index('by_softwareId', ['softwareId']),

	githubInstallIntents: defineTable({
		stateHash: v.string(),
		ownerType: ownerTypeValidator,
		ownerId: v.string(),
		createdBy: v.string(),
		status: v.union(
			v.literal('pending'),
			v.literal('processing'),
			v.literal('completed'),
			v.literal('failed'),
		),
		installationId: v.optional(v.number()),
		expiresAt: v.number(),
		lastError: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_state_hash', ['stateHash'])
		.index('by_created_by_and_status', ['createdBy', 'status']),

	plugins: defineTable({
		ownerType: ownerTypeValidator,
		ownerId: v.string(),
		createdBy: v.string(),
		repositoryId: v.id('githubRepositories'),
		softwareId: v.id('serverSoftware'),
		slug: v.string(),
		name: v.string(),
		summary: v.string(),
		description: v.optional(v.string()),
		searchText: v.string(),
		license: v.optional(v.string()),
		iconUrl: v.optional(v.string()),
		// Links shown on the plugin page (functions/plugins/publishing/model:saveLinks).
		// Source code is always the repository; issues default to its issue tracker.
		websiteUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		issuesUrl: v.optional(v.string()),
		donationUrl: v.optional(v.string()),
		visibility: projectVisibilityValidator,
		status: projectStatusValidator,
		latestVersionId: v.optional(v.id('pluginVersions')),
		downloadCount: v.number(),
		downloadCounterReadyAt: v.optional(v.number()),
		downloadCountRefreshScheduledAt: v.optional(v.number()),
		ratingAverage: v.number(),
		ratingCount: v.number(),
		publishedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_slug', ['slug'])
		.index('by_repository_id', ['repositoryId'])
		.index('by_owner_type_and_owner_id', ['ownerType', 'ownerId'])
		.index('by_software_id', ['softwareId'])
		.index('by_visibility_and_status', ['visibility', 'status'])
		.index('by_visibility_and_status_and_software_id', [
			'visibility',
			'status',
			'softwareId',
		])
		.index('by_visibility_and_status_and_updated_at', [
			'visibility',
			'status',
			'updatedAt',
		])
		.index('by_visibility_and_status_and_software_id_and_updated_at', [
			'visibility',
			'status',
			'softwareId',
			'updatedAt',
		])
		.index('by_visibility_and_status_and_download_count', [
			'visibility',
			'status',
			'downloadCount',
		])
		.index('by_visibility_and_status_and_rating_average', [
			'visibility',
			'status',
			'ratingAverage',
		])
		.index('by_visibility_and_status_and_software_id_and_download_count', [
			'visibility',
			'status',
			'softwareId',
			'downloadCount',
		])
		.index('by_visibility_and_status_and_software_id_and_rating_average', [
			'visibility',
			'status',
			'softwareId',
			'ratingAverage',
		])
		.index('by_owner_type_and_owner_id_and_visibility_and_status', [
			'ownerType',
			'ownerId',
			'visibility',
			'status',
		])
		.index('by_visibility_and_updated_at', ['visibility', 'updatedAt'])
		.searchIndex('search_search_text', {
			searchField: 'searchText',
			filterFields: ['visibility', 'status', 'softwareId'],
		}),

	pluginVersions: defineTable({
		projectId: v.id('plugins'),
		version: v.string(),
		normalizedVersion: v.string(),
		changelog: v.optional(v.string()),
		minecraftVersion: v.optional(v.string()),
		status: v.union(
			v.literal('draft'),
			v.literal('published'),
			v.literal('archived'),
		),
		publishedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_project_id', ['projectId'])
		.index('by_project_id_and_normalized_version', [
			'projectId',
			'normalizedVersion',
		])
		.index('by_project_id_and_status', ['projectId', 'status']),

	// One per run of the managed workflow, kept in sync from GitHub. Builds of
	// pushes that succeeded with the unmodified workflow can be sent to review.
	pluginBuilds: defineTable({
		projectId: v.id('plugins'),
		repositoryId: v.id('githubRepositories'),
		workflowRunId: v.number(),
		workflowName: v.string(),
		// push, pull_request, or workflow_dispatch.
		event: v.optional(v.string()),
		commitSha: v.string(),
		commitMessage: v.optional(v.string()),
		branch: v.optional(v.string()),
		status: buildStatusValidator,
		conclusion: v.optional(buildConclusionValidator),
		logsUrl: v.string(),
		// The `plugin-package` artifact. GitHub deletes artifacts after their
		// retention period, so a build is copied to R2 when it is sent to review.
		artifactId: v.optional(v.number()),
		artifactSize: v.optional(v.number()),
		artifactExpiresAt: v.optional(v.number()),
		// Git blob SHA of the workflow file at the build's commit.
		workflowBlobSha: v.optional(v.string()),
		// True when that file is byte-identical to the one BedrockNexus
		// installed, so the build ran the managed workflow unmodified.
		traceable: v.optional(v.boolean()),
		completedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_workflow_run_id', ['workflowRunId'])
		.index('by_project_id', ['projectId'])
		.index('by_project_id_and_created_at', ['projectId', 'createdAt'])
		.index('by_repository_id_and_commit_sha', [
			'repositoryId',
			'commitSha',
		]),

	// A build a developer sent to review under a version number. Approval makes
	// it a published pluginVersions row and serves the file from the CDN.
	pluginReleases: defineTable({
		projectId: v.id('plugins'),
		repositoryId: v.id('githubRepositories'),
		buildId: v.id('pluginBuilds'),
		// Created when the release is published.
		versionId: v.optional(v.id('pluginVersions')),
		version: v.string(),
		normalizedVersion: v.string(),
		changelog: v.string(),
		commitSha: v.string(),
		branch: v.optional(v.string()),
		traceable: v.boolean(),
		status: releaseStatusValidator,
		failureReason: v.optional(v.string()),
		fileName: v.optional(v.string()),
		size: v.optional(v.number()),
		sha256: v.optional(v.string()),
		// Private copy for moderators, removed once published.
		uploadKey: v.optional(v.string()),
		// Public copy downloads are served from.
		cdnKey: v.optional(v.string()),
		// The GitHub release BedrockNexus creates after approval, with the file
		// attached. A copy for people browsing GitHub; downloads use the CDN.
		githubReleaseStatus: v.optional(githubReleaseStatusValidator),
		githubReleaseId: v.optional(v.number()),
		githubReleaseUrl: v.optional(v.string()),
		githubReleaseError: v.optional(v.string()),
		submittedBy: v.string(),
		submittedAt: v.number(),
		reviewedAt: v.optional(v.number()),
		reviewedBy: v.optional(v.string()),
		reviewNotes: v.optional(v.string()),
		publishedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_project_id', ['projectId'])
		.index('by_project_id_and_status', ['projectId', 'status'])
		.index('by_project_id_and_normalized_version', [
			'projectId',
			'normalizedVersion',
		])
		.index('by_status_and_submitted_at', ['status', 'submittedAt'])
		.index('by_version_id', ['versionId'])
		.index('by_build_id', ['buildId']),

	// One per user and plugin (functions/plugins/reviews.ts). Deleting a review
	// deactivates it; plugins.ratingAverage/ratingCount follow the active ones.
	pluginReviews: defineTable({
		pluginId: v.id('plugins'),
		userId: v.string(),
		rating: v.number(),
		content: v.optional(v.string()),
		isEdited: v.optional(v.boolean()),
		isActive: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index('by_plugin_id_and_is_active', ['pluginId', 'isActive'])
		.index('by_plugin_id_and_user_id', ['pluginId', 'userId']),

	pluginDownloads: defineTable({
		projectId: v.id('plugins'),
		versionId: v.id('pluginVersions'),
		releaseId: v.id('pluginReleases'),
		userId: v.optional(v.string()),
		anonymousIdHash: v.optional(v.string()),
		userAgentHash: v.optional(v.string()),
		ownerCountedAt: v.number(),
		createdAt: v.number(),
	})
		.index('by_project_id_and_created_at', ['projectId', 'createdAt'])
		.index('by_version_id_and_created_at', ['versionId', 'createdAt'])
		.index('by_release_id_and_created_at', ['releaseId', 'createdAt'])
		.index('by_user_id_and_created_at', ['userId', 'createdAt'])
		.index('by_anonymous_id_hash_and_created_at', [
			'anonymousIdHash',
			'createdAt',
		]),

	githubWebhookDeliveries: defineTable(webhookDeliveryValidator)
		.index('by_delivery_id', ['deliveryId'])
		.index('by_status_and_completed_at', ['status', 'completedAt'])
		.index('by_event_and_received_at', ['event', 'receivedAt'])
		.index('by_installation_id_and_received_at', [
			'installationId',
			'receivedAt',
		])
		.index('by_repository_id_and_received_at', [
			'repositoryId',
			'receivedAt',
		]),

	githubWebhookDeliveryAttempts: defineTable(webhookDeliveryAttemptValidator)
		.index('by_webhook_delivery_id', ['webhookDeliveryId'])
		.index('by_webhook_delivery_id_and_attempt_number', [
			'webhookDeliveryId',
			'attemptNumber',
		]),
}
