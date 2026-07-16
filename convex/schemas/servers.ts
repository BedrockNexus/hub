import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Lifecycle (parity with projects)
export const serverLifecycleStatus = v.union(
	v.literal('draft'),
	v.literal('published'),
	v.literal('under_review'),
)

export const serverModerationStatus = v.union(
	v.literal('approved'),
	v.literal('pending'),
	v.literal('flagged'),
	v.literal('rejected'),
)

export const serverVerificationMethod = v.union(
	v.literal('motd_token'),
	v.literal('dns_txt'),
	v.literal('manual'),
)

// =============================================================================
// SERVER TABLES
// =============================================================================

export const tables = {
	// ===========================================================================
	// SERVER CATEGORIES
	// ===========================================================================
	serverCategories: defineTable({
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.number(),
		isActive: v.boolean(),
	})
		.index('by_slug', ['slug'])
		.index('by_active', ['isActive'])
		.index('by_sort_order', ['sortOrder']),

	// ===========================================================================
	// SERVERS
	// ===========================================================================
	servers: defineTable({
		// Basic Info
		name: v.string(),
		slug: v.string(),
		smallDescription: v.string(),
		description: v.optional(v.string()),

		// Connection
		ipAddress: v.string(),
		port: v.number(),

		// Media
		logoR2Key: v.optional(v.string()),
		bannerR2Key: v.optional(v.string()),

		// Categorization
		categoryIds: v.array(v.id('serverCategories')),
		tags: v.optional(v.array(v.string())),

		// Links
		website: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		storeUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),

		// Ownership
		ownerType: v.union(v.literal('user'), v.literal('organization')),
		ownerId: v.string(), // userId or organizationId based on ownerType
		registeredBy: v.string(), // Original creator (audit trail)

		isFeatured: v.optional(v.boolean()),

		// Lifecycle
		status: serverLifecycleStatus,
		publishedAt: v.optional(v.number()),
		moderationStatus: v.optional(serverModerationStatus),
		moderationReason: v.optional(v.string()),
		moderatedAt: v.optional(v.number()),
		moderatedBy: v.optional(v.string()),

		// Server metadata
		region: v.optional(v.string()),
		language: v.optional(v.array(v.string())),
		gameVersions: v.optional(v.array(v.string())),

		// Ownership verification
		verifiedAt: v.optional(v.number()),
		verifiedBy: v.optional(v.string()),
		verificationMethod: v.optional(serverVerificationMethod),

		// Timestamps
		updatedAt: v.optional(v.number()),
	})
		.index('by_slug', ['slug'])
		.index('by_owner', ['ownerType', 'ownerId'])
		.index('by_registered_by', ['registeredBy'])
		.index('by_status', ['status'])
		.index('by_featured', ['isFeatured'])
		.searchIndex('search_servers', {
			searchField: 'name',
			filterFields: ['status', 'categoryIds', 'tags'],
		}),

	serverVerificationProofs: defineTable({
		userId: v.string(),
		ipAddress: v.string(),
		port: v.number(),
		method: serverVerificationMethod,
		verifiedAt: v.number(),
		expiresAt: v.number(),
	})
		.index('by_user_address', ['userId', 'ipAddress', 'port'])
		.index('by_expiry', ['expiresAt']),

	// ===========================================================================
	// SERVER GALLERY
	// ===========================================================================
	serverGallery: defineTable({
		serverId: v.id('servers'),
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
		.index('by_server', ['serverId'])
		.index('by_server_sort', ['serverId', 'sortOrder'])
		.index('by_owner', ['ownerId']),

	// ===========================================================================
	// SERVER STATS (Denormalized counters)
	// ===========================================================================
	serverStats: defineTable({
		serverId: v.id('servers'),

		// Counters
		totalIpCopies: v.number(),
		totalIpCopiesToday: v.optional(v.number()),
		totalIpCopiesThisMonth: v.optional(v.number()),
		totalVotes: v.optional(v.number()),
		totalVotesToday: v.optional(v.number()),
		totalVotesThisMonth: v.optional(v.number()),

		// Date keys (UTC) for today/month counters
		dailyKey: v.optional(v.string()), // YYYY-MM-DD
		monthlyKey: v.optional(v.string()), // YYYY-MM

		// Reviews
		averageRating: v.number(), // 0-5
		reviewCount: v.number(),

		// Timestamps
		updatedAt: v.number(),
	})
		.index('by_server', ['serverId'])
		.index('by_rating', ['averageRating']),

	// ===========================================================================
	// SERVER STATUS CACHE
	// ===========================================================================
	serverStatus: defineTable({
		serverId: v.id('servers'),

		// Status info
		online: v.boolean(),
		playerCount: v.number(),
		maxPlayers: v.number(),
		motd: v.optional(v.string()),
		version: v.optional(v.string()),
		gameMode: v.optional(v.string()),
		softwareClassification: v.optional(
			v.union(
				v.literal('native_bedrock'),
				v.literal('geyser_likely'),
				v.literal('ambiguous'),
			),
		),
		softwareReasons: v.optional(v.array(v.string())),

		// Ping info
		latency: v.optional(v.number()),

		// Timing
		lastChecked: v.number(),
		lastOnline: v.optional(v.number()),

		// Reliability tracking
		checksTotal: v.number(),
		checksOnline: v.number(),
		uptimePercent: v.number(),
	})
		.index('by_server', ['serverId'])
		.index('by_online', ['online'])
		.index('by_last_checked', ['lastChecked']),

	// ===========================================================================
	// SERVER REVIEWS
	// ===========================================================================
	serverReviews: defineTable({
		serverId: v.id('servers'),
		userId: v.string(),

		// Review content
		rating: v.number(), // 1-5
		content: v.optional(v.string()),

		// Engagement
		helpfulCount: v.optional(v.number()),
		isEdited: v.optional(v.boolean()),

		// Owner reply
		ownerReply: v.optional(
			v.object({
				content: v.string(),
				createdAt: v.number(),
			}),
		),

		// Status
		isActive: v.boolean(), // For moderation

		// Timestamps
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index('by_server', ['serverId'])
		.index('by_user', ['userId'])
		.index('by_server_user', ['serverId', 'userId']) // One review per user per server
		.index('by_server_rating', ['serverId', 'rating']),

	// ===========================================================================
	// SERVER STATUS HISTORY (one row per ping for graphs / uptime trends)
	// Cron `purgeServerStatusHistory` keeps only last 30 days.
	// ===========================================================================
	serverStatusHistory: defineTable({
		serverId: v.id('servers'),
		online: v.boolean(),
		playerCount: v.number(),
		maxPlayers: v.optional(v.number()),
		latency: v.optional(v.number()),
		checkedAt: v.number(),
	})
		.index('by_server_time', ['serverId', 'checkedAt'])
		.index('by_time', ['checkedAt']),
}
