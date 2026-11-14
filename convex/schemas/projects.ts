import { submissionFields } from './submissions'
import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// =============================================================================
// RELEASE CONTENT CHECKS (reported by the artifact validator)
// =============================================================================

/** One file inside a release, as listed by the validator. */
export const releaseFile = v.object({
	path: v.string(),
	size: v.number(),
	crc32: v.number(),
})

/** Something a moderator should look at; findings never reject a file. */
export const releaseFinding = v.object({
	code: v.string(),
	level: v.union(v.literal('warning'), v.literal('info')),
	message: v.string(),
	paths: v.optional(v.array(v.string())),
})

export const releaseScriptModule = v.object({
	name: v.string(),
	version: v.optional(v.string()),
})

// =============================================================================
// PROJECT TYPE
// =============================================================================

export const projectType = v.union(
	v.literal('addon'),
	v.literal('resource_pack'),
	// Remove after functions/projects/migrations:migrateTexturePacks is run.
	v.literal('texture_pack'),
)

export const projectMetadata = v.union(
	v.object({
		type: v.literal('addon'),
		behaviorPackIncluded: v.boolean(),
		resourcePackIncluded: v.boolean(),
		experimentalFeaturesRequired: v.boolean(),
		dependencies: v.array(
			v.object({ name: v.string(), url: v.optional(v.string()) }),
		),
	}),
	v.object({
		type: v.literal('resource_pack'),
		resolution: v.union(
			v.literal('8x'),
			v.literal('16x'),
			v.literal('32x'),
			v.literal('64x'),
			v.literal('128x'),
			v.literal('256x'),
			v.literal('512x'),
			v.literal('custom'),
		),
		contentTypes: v.array(
			v.union(
				v.literal('textures'),
				v.literal('ui'),
				v.literal('sounds'),
				v.literal('shaders'),
			),
		),
	}),
)

// Stored types after normalization; see normalizeProjectType.
export const projectDiscoveryType = v.union(
	v.literal('addon'),
	v.literal('resource_pack'),
)

// =============================================================================
// LIFECYCLE STATUS (replaces binary isActive going forward)
// =============================================================================

export const projectStatus = v.union(
	v.literal('draft'),
	v.literal('published'),
	v.literal('under_review'),
)

export const moderationStatus = v.union(
	v.literal('approved'),
	v.literal('pending'),
	v.literal('flagged'),
	v.literal('rejected'),
)

// =============================================================================
// PROJECT TABLES
// =============================================================================

export const tables = {
	// ===========================================================================
	// PROJECT CATEGORIES
	// ===========================================================================
	projectCategories: defineTable({
		projectType,
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.number(),
		isActive: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
		// Usage counters maintained by lib/categoryCounts.ts.
		projectCount: v.optional(v.number()),
		publishedProjectCount: v.optional(v.number()),
	})
		.index('by_slug', ['slug'])
		.index('by_type', ['projectType'])
		.index('by_type_and_slug', ['projectType', 'slug'])
		.index('by_active', ['isActive'])
		.index('by_sort_order', ['sortOrder']),

	projects: defineTable({
		// Immutable public route identity; optional until backfilled.
		publicId: v.optional(v.string()),
		...submissionFields,
		submittedVersionIds: v.optional(v.array(v.id('projectVersions'))),
		// Type
		type: projectType,

		// Basic Info
		name: v.string(),
		slug: v.string(),
		summary: v.string(),
		description: v.string(),

		// Media
		iconR2Key: v.optional(v.string()),
		bannerR2Key: v.optional(v.string()),

		// Categorization
		categoryIds: v.array(v.id('projectCategories')),
		tags: v.optional(v.array(v.string())),
		metadata: v.optional(projectMetadata),

		// Links
		sourceUrl: v.optional(v.string()),
		websiteUrl: v.optional(v.string()),
		issueTrackerUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		donationUrl: v.optional(v.string()),

		// Ownership
		ownerType: v.union(v.literal('user'), v.literal('organization')),
		ownerId: v.string(),
		createdBy: v.string(),

		// Lifecycle
		status: projectStatus,
		moderationStatus: v.optional(moderationStatus),
		moderationReason: v.optional(v.string()),
		moderatedAt: v.optional(v.number()),
		moderatedBy: v.optional(v.string()),
		publishedAt: v.optional(v.number()),

		// Legal
		license: v.optional(v.string()),
		licenseCustom: v.optional(v.string()),
		credits: v.optional(
			v.array(
				v.object({
					userId: v.optional(v.string()),
					name: v.string(),
					role: v.string(),
					url: v.optional(v.string()),
				}),
			),
		),

		// Cached "latest version"
		latestVersionId: v.optional(v.id('projectVersions')),
		latestVersionString: v.optional(v.string()),
		latestVersionAt: v.optional(v.number()),
		versionCount: v.optional(v.number()),
		// Minecraft versions covered by any public release.
		supportedGameVersions: v.optional(v.array(v.string())),

		// Name, summary, tags and category names; see lib/discovery.ts.
		searchText: v.optional(v.string()),

		// Timestamps (epoch ms)
		updatedAt: v.number(),
	})
		.index('by_submission_status', ['submissionStatus', 'submittedAt'])
		.index('by_publicId', ['publicId'])
		.index('by_slug', ['slug'])
		.index('by_status', ['status'])
		.index('by_type_status', ['type', 'status'])
		.index('by_moderation_status', ['moderationStatus'])
		.index('by_owner', ['ownerType', 'ownerId'])
		.index('by_created_by', ['createdBy'])
		.searchIndex('search_projects', {
			searchField: 'name',
			filterFields: ['status', 'categoryIds', 'type'],
		})
		.searchIndex('search_text', {
			searchField: 'searchText',
			filterFields: ['status', 'moderationStatus', 'type'],
		}),

	projectGallery: defineTable({
		projectId: v.id('projects'),
		ownerId: v.string(),
		r2Key: v.string(),
		fileName: v.string(),
		fileSize: v.number(),
		mimeType: v.string(),
		caption: v.optional(v.string()),
		sortOrder: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_project', ['projectId'])
		.index('by_project_sort', ['projectId', 'sortOrder'])
		.index('by_owner', ['ownerId']),

	projectVersions: defineTable({
		projectId: v.id('projects'),

		// Version info
		version: v.string(),
		changelog: v.optional(v.string()),

		// File
		r2Key: v.string(),
		uploadR2Key: v.optional(v.string()),
		cdnR2Key: v.optional(v.string()),
		fileName: v.string(),
		fileSize: v.number(),
		artifactId: v.optional(v.string()),
		validationStatus: v.optional(
			v.union(
				v.literal('pending'),
				v.literal('validating'),
				v.literal('valid'),
				v.literal('invalid'),
			),
		),
		validationCode: v.optional(v.string()),
		validationError: v.optional(v.string()),
		validationAttempts: v.optional(v.number()),
		validationReport: v.optional(
			v.object({
				type: v.string(),
				fileSize: v.number(),
				entryCount: v.optional(v.number()),
				totalUncompressedSize: v.optional(v.number()),
				manifestCount: v.optional(v.number()),
				width: v.optional(v.number()),
				height: v.optional(v.number()),
				sha256: v.optional(v.string()),
				// Content checks, from validator checks version 1 on. The
				// file list itself is in projectVersionFiles.
				checksVersion: v.optional(v.number()),
				fileCount: v.optional(v.number()),
				scriptModules: v.optional(v.array(releaseScriptModule)),
				findings: v.optional(v.array(releaseFinding)),
			}),
		),
		validatedAt: v.optional(v.number()),

		// Moderator review. Releases of public projects stay private until
		// approved; releases submitted with a new project are approved when the
		// project is published. Undefined on releases that predate review.
		reviewStatus: v.optional(
			v.union(
				v.literal('pending'),
				v.literal('approved'),
				v.literal('rejected'),
			),
		),
		standaloneReviewPending: v.optional(v.boolean()),
		reviewReason: v.optional(v.string()),
		reviewedAt: v.optional(v.number()),
		reviewedBy: v.optional(v.string()),

		// Compatibility. `gameVersions` is what the creator declares;
		// `minEngineVersion` is the highest min_engine_version in the pack
		// manifests, read by the validator (structural, not a gameplay test).
		gameVersions: v.optional(v.array(v.string())),
		minEngineVersion: v.optional(v.string()),
		// The creator says this release breaks worlds, packs or add-ons that
		// used an earlier one. Owners of listings that depend on it are told.
		breakingChanges: v.optional(v.boolean()),

		downloads: v.number(),

		publishedAt: v.optional(v.number()),
		deletionRequestedAt: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index('by_project', ['projectId'])
		.index('by_project_version', ['projectId', 'version'])
		.index('by_review_status', ['reviewStatus'])
		.index('by_project_and_review_status', ['projectId', 'reviewStatus'])
		.index('by_project_and_standalone_review_pending', [
			'projectId',
			'standaloneReviewPending',
		])
		.index('by_standalone_review_pending', [
			'standaloneReviewPending',
			'createdAt',
		]),

	/**
	 * The packs inside a release, from their manifests (validator). Lets
	 * manifest dependencies resolve to BedrockNexus listings and the launcher
	 * recognise packs a player already has installed.
	 */
	releasePacks: defineTable({
		versionId: v.id('projectVersions'),
		projectId: v.id('projects'),
		uuid: v.string(), // lower case
		version: v.optional(v.string()), // e.g. "1.2.0"
		kind: v.union(
			v.literal('behavior'),
			v.literal('resources'),
			v.literal('skins'),
			v.literal('world'),
			v.literal('other'),
		),
	})
		.index('by_uuid', ['uuid'])
		.index('by_versionId', ['versionId'])
		.index('by_projectId', ['projectId']),

	/**
	 * What a release needs, works with, or breaks. `creator` rows are declared
	 * when publishing; `manifest` rows come from pack manifest dependencies and
	 * resolve to listings by pack UUID when read.
	 */
	releaseDependencies: defineTable({
		versionId: v.id('projectVersions'),
		projectId: v.id('projects'),
		kind: v.union(
			v.literal('required'),
			v.literal('optional'),
			v.literal('incompatible'),
		),
		source: v.union(v.literal('creator'), v.literal('manifest')),
		// One of: a BedrockNexus listing, an external link, or a pack UUID.
		dependencyProjectId: v.optional(v.id('projects')),
		dependencyPluginId: v.optional(v.id('plugins')),
		externalName: v.optional(v.string()),
		externalUrl: v.optional(v.string()),
		packUuid: v.optional(v.string()),
		packVersion: v.optional(v.string()),
	})
		.index('by_versionId', ['versionId'])
		.index('by_dependencyProjectId', ['dependencyProjectId'])
		.index('by_packUuid', ['packUuid']),

	/** The files inside a release, compared between versions in review. */
	projectVersionFiles: defineTable({
		versionId: v.id('projectVersions'),
		files: v.array(releaseFile),
		// More files than were listed (very large packs).
		truncated: v.boolean(),
	}).index('by_versionId', ['versionId']),

	projectArtifactUploads: defineTable({
		projectId: v.id('projects'),
		userId: v.string(),
		projectType,
		version: v.string(),
		artifactId: v.string(),
		r2Key: v.string(),
		fileName: v.string(),
		declaredFileSize: v.number(),
		maxFileSize: v.number(),
		status: v.union(
			v.literal('pending'),
			v.literal('consumed'),
			v.literal('rejected'),
		),
		error: v.optional(v.string()),
		createdAt: v.number(),
		expiresAt: v.number(),
	})
		.index('by_project', ['projectId'])
		.index('by_user', ['userId'])
		.index('by_status_expires', ['status', 'expiresAt']),

	projectStats: defineTable({
		projectId: v.id('projects'),

		totalDownloads: v.number(),
		totalDownloadsToday: v.optional(v.number()),
		totalDownloadsThisMonth: v.optional(v.number()),

		dailyKey: v.optional(v.string()),
		monthlyKey: v.optional(v.string()),

		averageRating: v.number(),
		reviewCount: v.number(),

		// Discovery fields, copied here by lib/discovery.ts so public listings
		// read in index order instead of scanning and sorting every project.
		// They live on this document, not on the project, so counters changing
		// never invalidate queries that only read the project.
		isPublic: v.optional(v.boolean()),
		type: v.optional(projectDiscoveryType),
		publishedAt: v.optional(v.number()),
		lastReleaseAt: v.optional(v.number()),
		// Library saves (private; no longer read by any listing order).
		favouriteCount: v.optional(v.number()),
		// Public follows (lib/follows.ts); the "Most followed" order.
		followerCount: v.optional(v.number()),
		downloads7d: v.optional(v.number()),
		trendingScore: v.optional(v.number()),

		updatedAt: v.number(),
	})
		.index('by_project', ['projectId'])
		.index('by_rating', ['averageRating'])
		.index('by_downloads', ['totalDownloads'])
		.index('by_isPublic_and_totalDownloads', ['isPublic', 'totalDownloads'])
		.index('by_isPublic_and_trendingScore', ['isPublic', 'trendingScore'])
		.index('by_isPublic_and_lastReleaseAt', ['isPublic', 'lastReleaseAt'])
		.index('by_isPublic_and_publishedAt', ['isPublic', 'publishedAt'])
		.index('by_isPublic_and_followerCount', ['isPublic', 'followerCount'])
		.index('by_isPublic_and_averageRating', ['isPublic', 'averageRating'])
		.index('by_isPublic_and_type_and_totalDownloads', [
			'isPublic',
			'type',
			'totalDownloads',
		])
		.index('by_isPublic_and_type_and_trendingScore', [
			'isPublic',
			'type',
			'trendingScore',
		])
		.index('by_isPublic_and_type_and_lastReleaseAt', [
			'isPublic',
			'type',
			'lastReleaseAt',
		])
		.index('by_isPublic_and_type_and_publishedAt', [
			'isPublic',
			'type',
			'publishedAt',
		])
		.index('by_isPublic_and_type_and_followerCount', [
			'isPublic',
			'type',
			'followerCount',
		])
		.index('by_isPublic_and_type_and_averageRating', [
			'isPublic',
			'type',
			'averageRating',
		]),

	// One row per project per UTC day that had activity. Feeds trending and
	// creator analytics; rows are never rewritten after their day ends.
	projectDailyStats: defineTable({
		projectId: v.id('projects'),
		dayKey: v.string(), // YYYY-MM-DD
		downloads: v.number(), // counted downloads from every source
		favourites: v.number(), // net library saves that day (not ranked on)
		// Net new follows that day; trending reads this. Undefined before follows.
		follows: v.optional(v.number()),
		// Of `downloads`, those through the public API (launchers); the rest
		// came from the website. Undefined on days before this was recorded.
		apiDownloads: v.optional(v.number()),
		// Detail page views, one per visitor per day (functions/site/engagement).
		views: v.optional(v.number()),
	}).index('by_projectId_and_dayKey', ['projectId', 'dayKey']),

	projectReviews: defineTable({
		projectId: v.id('projects'),
		userId: v.string(),

		versionId: v.optional(v.id('projectVersions')),

		rating: v.number(),
		content: v.optional(v.string()),

		helpfulCount: v.optional(v.number()),
		isEdited: v.optional(v.boolean()),

		authorReply: v.optional(
			v.object({
				content: v.string(),
				createdAt: v.number(),
			}),
		),

		isActive: v.boolean(),

		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index('by_project', ['projectId'])
		.index('by_user', ['userId'])
		.index('by_project_user', ['projectId', 'userId'])
		.index('by_project_rating', ['projectId', 'rating']),
}
