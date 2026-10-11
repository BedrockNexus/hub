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

export const publishingDraftStatusValidator = v.union(
	v.literal('detected'),
	v.literal('metadataReady'),
	v.literal('workflowInstalled'),
	v.literal('releaseDetected'),
	v.literal('readyToPublish'),
	v.literal('inReview'),
	v.literal('changesRequested'),
	v.literal('rejected'),
	v.literal('published'),
)

export const workflowTemplateKeyValidator = v.string()

export const publishingDraftValidator = v.object({
	_id: v.id('pluginPublishingDrafts'),
	_creationTime: v.number(),
	ownerType: ownerTypeValidator,
	ownerId: v.string(),
	createdBy: v.string(),
	repositoryId: v.id('githubRepositories'),
	projectId: v.optional(v.id('plugins')),
	adapterId: v.union(v.literal('pocketmine-mp'), v.literal('powernukkitx')),
	projectType: v.literal('plugin'),
	detectionScore: v.number(),
	detectionSummary: v.string(),
	name: v.string(),
	slug: v.string(),
	summary: v.string(),
	description: v.optional(v.string()),
	license: v.optional(v.string()),
	readmeExcerpt: v.optional(v.string()),
	workflowPath: v.string(),
	workflowBranch: v.optional(v.string()),
	workflowPullRequestNumber: v.optional(v.number()),
	workflowPullRequestUrl: v.optional(v.string()),
	workflowPullRequestState: v.optional(
		v.union(v.literal('open'), v.literal('closed'), v.literal('merged')),
	),
	workflowCommitSha: v.optional(v.string()),
	// Git blob SHA of the managed workflow file BedrockNexus installed.
	workflowBlobSha: v.optional(v.string()),
	workflowTemplateKey: v.optional(v.string()),
	workflowTemplateVersion: v.optional(v.number()),
	workflowInstalledAt: v.optional(v.number()),
	workflowInstalled: v.boolean(),
	latestWorkflowRunId: v.optional(v.number()),
	latestWorkflowRunUrl: v.optional(v.string()),
	latestWorkflowRunStatus: v.optional(v.string()),
	latestWorkflowRunConclusion: v.optional(v.string()),
	latestTag: v.optional(v.string()),
	latestReleaseId: v.optional(v.number()),
	latestReleaseUrl: v.optional(v.string()),
	latestReleaseCommitSha: v.optional(v.string()),
	primaryAssetId: v.optional(v.number()),
	primaryAssetName: v.optional(v.string()),
	primaryAssetUrl: v.optional(v.string()),
	verifiedBuild: v.boolean(),
	moderationReady: v.boolean(),
	status: publishingDraftStatusValidator,
	submittedAt: v.optional(v.number()),
	reviewedAt: v.optional(v.number()),
	reviewedBy: v.optional(v.string()),
	reviewNotes: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
})

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

	pluginPublishingDrafts: defineTable({
		ownerType: ownerTypeValidator,
		ownerId: v.string(),
		createdBy: v.string(),
		repositoryId: v.id('githubRepositories'),
		projectId: v.optional(v.id('plugins')),
		adapterId: v.union(
			v.literal('pocketmine-mp'),
			v.literal('powernukkitx'),
		),
		projectType: v.literal('plugin'),
		detectionScore: v.number(),
		detectionSummary: v.string(),
		name: v.string(),
		slug: v.string(),
		summary: v.string(),
		description: v.optional(v.string()),
		license: v.optional(v.string()),
		readmeExcerpt: v.optional(v.string()),
		workflowPath: v.string(),
		workflowBranch: v.optional(v.string()),
		workflowPullRequestNumber: v.optional(v.number()),
		workflowPullRequestUrl: v.optional(v.string()),
		workflowPullRequestState: v.optional(
			v.union(
				v.literal('open'),
				v.literal('closed'),
				v.literal('merged'),
			),
		),
		workflowCommitSha: v.optional(v.string()),
		// Git blob SHA of the managed workflow file BedrockNexus installed.
		workflowBlobSha: v.optional(v.string()),
		workflowTemplateKey: v.optional(v.string()),
		workflowTemplateVersion: v.optional(v.number()),
		workflowInstalledAt: v.optional(v.number()),
		workflowInstalled: v.boolean(),
		latestWorkflowRunId: v.optional(v.number()),
		latestWorkflowRunUrl: v.optional(v.string()),
		latestWorkflowRunStatus: v.optional(v.string()),
		latestWorkflowRunConclusion: v.optional(v.string()),
		latestTag: v.optional(v.string()),
		latestReleaseId: v.optional(v.number()),
		latestReleaseUrl: v.optional(v.string()),
		latestReleaseCommitSha: v.optional(v.string()),
		primaryAssetId: v.optional(v.number()),
		primaryAssetName: v.optional(v.string()),
		primaryAssetUrl: v.optional(v.string()),
		verifiedBuild: v.boolean(),
		moderationReady: v.boolean(),
		status: publishingDraftStatusValidator,
		submittedAt: v.optional(v.number()),
		reviewedAt: v.optional(v.number()),
		reviewedBy: v.optional(v.string()),
		reviewNotes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_owner_type_and_owner_id', ['ownerType', 'ownerId'])
		.index('by_status', ['status'])
		.index('by_repository_id', ['repositoryId'])
		.index('by_project_id', ['projectId'])
		.index('by_workflow_template_key', ['workflowTemplateKey'])
		.index('by_repository_id_and_status', ['repositoryId', 'status']),

	pluginWorkflowTemplates: defineTable({
		key: workflowTemplateKeyValidator,
		adapterId: v.union(
			v.literal('pocketmine-mp'),
			v.literal('powernukkitx'),
		),
		buildSystem: v.union(
			v.literal('composer'),
			v.literal('gradle'),
			v.literal('maven'),
		),
		label: v.optional(v.string()),
		content: v.string(),
		version: v.number(),
		updatedBy: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index('by_key', ['key']),

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

	pluginBuilds: defineTable({
		projectId: v.id('plugins'),
		repositoryId: v.id('githubRepositories'),
		versionId: v.optional(v.id('pluginVersions')),
		workflowRunId: v.number(),
		workflowName: v.string(),
		commitSha: v.string(),
		branch: v.optional(v.string()),
		tag: v.optional(v.string()),
		status: v.union(
			v.literal('queued'),
			v.literal('inProgress'),
			v.literal('completed'),
		),
		conclusion: v.optional(
			v.union(
				v.literal('success'),
				v.literal('failure'),
				v.literal('cancelled'),
				v.literal('skipped'),
				v.literal('timedOut'),
				v.literal('actionRequired'),
			),
		),
		logsUrl: v.string(),
		completedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_workflow_run_id', ['workflowRunId'])
		.index('by_project_id', ['projectId'])
		.index('by_project_id_and_status', ['projectId', 'status'])
		.index('by_version_id', ['versionId'])
		.index('by_repository_id_and_commit_sha', [
			'repositoryId',
			'commitSha',
		]),

	pluginReleases: defineTable({
		projectId: v.id('plugins'),
		versionId: v.id('pluginVersions'),
		buildId: v.optional(v.id('pluginBuilds')),
		repositoryId: v.id('githubRepositories'),
		githubReleaseId: v.number(),
		tagName: v.string(),
		releaseUrl: v.string(),
		commitSha: v.string(),
		status: v.union(
			v.literal('detected'),
			v.literal('verified'),
			v.literal('published'),
			v.literal('rejected'),
		),
		verifiedBuild: v.boolean(),
		// Why the release is not a traceable build (see convex/lib/buildProvenance.ts).
		verificationFailure: v.optional(v.string()),
		publishedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_github_release_id', ['githubReleaseId'])
		.index('by_project_id', ['projectId'])
		.index('by_project_id_and_status', ['projectId', 'status'])
		.index('by_version_id', ['versionId'])
		.index('by_build_id', ['buildId'])
		.index('by_repository_id', ['repositoryId']),

	pluginReleaseAssets: defineTable({
		releaseId: v.id('pluginReleases'),
		githubAssetId: v.number(),
		name: v.string(),
		downloadUrl: v.string(),
		size: v.number(),
		contentType: v.optional(v.string()),
		// GitHub-reported digest of the asset, e.g. `sha256:...`.
		digest: v.optional(v.string()),
		sha256: v.optional(v.string()),
		isPrimary: v.boolean(),
		status: v.union(v.literal('accepted'), v.literal('rejected')),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_github_asset_id', ['githubAssetId'])
		.index('by_release_id', ['releaseId'])
		.index('by_release_id_and_is_primary', ['releaseId', 'isPrimary']),

	pluginDownloads: defineTable({
		projectId: v.id('plugins'),
		versionId: v.id('pluginVersions'),
		releaseAssetId: v.id('pluginReleaseAssets'),
		userId: v.optional(v.string()),
		anonymousIdHash: v.optional(v.string()),
		userAgentHash: v.optional(v.string()),
		ownerCountedAt: v.number(),
		createdAt: v.number(),
	})
		.index('by_project_id_and_created_at', ['projectId', 'createdAt'])
		.index('by_version_id_and_created_at', ['versionId', 'createdAt'])
		.index('by_release_asset_id_and_created_at', [
			'releaseAssetId',
			'createdAt',
		])
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
