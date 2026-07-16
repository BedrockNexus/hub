import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// =============================================================================
// PROJECT TYPE
// =============================================================================

export const projectType = v.union(
	v.literal('addon'),
	v.literal('skin'),
	v.literal('map'),
	v.literal('texture_pack'),
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
	})
		.index('by_slug', ['slug'])
		.index('by_type', ['projectType'])
		.index('by_type_and_slug', ['projectType', 'slug'])
		.index('by_active', ['isActive'])
		.index('by_sort_order', ['sortOrder']),

	projects: defineTable({
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
		isFeatured: v.optional(v.boolean()),
		moderationStatus: v.optional(moderationStatus),
		moderationReason: v.optional(v.string()),
		moderatedAt: v.optional(v.number()),
		moderatedBy: v.optional(v.string()),
		publishedAt: v.optional(v.number()),
		scheduledFor: v.optional(v.number()),

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

		// Timestamps (epoch ms)
		updatedAt: v.number(),
	})
		.index('by_slug', ['slug'])
		.index('by_status', ['status'])
		.index('by_type_status', ['type', 'status'])
		.index('by_moderation_status', ['moderationStatus'])
		.index('by_owner', ['ownerType', 'ownerId'])
		.index('by_created_by', ['createdBy'])
		.index('by_featured', ['isFeatured'])
		.searchIndex('search_projects', {
			searchField: 'name',
			filterFields: ['status', 'categoryIds', 'type'],
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
		versionNumeric: v.optional(v.number()),
		changelog: v.optional(v.string()),

		// File
		r2Key: v.string(),
		fileName: v.string(),
		fileSize: v.number(),

		// Compatibility
		gameVersions: v.optional(v.array(v.string())),

		downloads: v.number(),

		publishedAt: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index('by_project', ['projectId'])
		.index('by_project_version', ['projectId', 'version']),

	projectStats: defineTable({
		projectId: v.id('projects'),

		totalDownloads: v.number(),
		totalDownloadsToday: v.optional(v.number()),
		totalDownloadsThisMonth: v.optional(v.number()),

		dailyKey: v.optional(v.string()),
		monthlyKey: v.optional(v.string()),

		averageRating: v.number(),
		reviewCount: v.number(),

		updatedAt: v.number(),
	})
		.index('by_project', ['projectId'])
		.index('by_rating', ['averageRating'])
		.index('by_downloads', ['totalDownloads']),

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
