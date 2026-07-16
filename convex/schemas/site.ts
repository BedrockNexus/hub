import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// =============================================================================
// SITE-WIDE TABLES (Settings, Analytics, User Profiles)
// =============================================================================

export const tables = {
	// ===========================================================================
	// SITE SETTINGS
	// ===========================================================================
	siteSettings: defineTable({
		key: v.string(),
		value: v.any(),
		description: v.optional(v.string()),
		updatedAt: v.number(),
		updatedBy: v.optional(v.string()),
	}).index('by_key', ['key']),

	// ===========================================================================
	// USER PROFILES (Extended profile data beyond Better Auth user table)
	// ===========================================================================
	userProfiles: defineTable({
		userId: v.string(), // Better Auth user ID

		// Display
		displayName: v.optional(v.string()), // Overrides Better Auth name on profile
		bio: v.optional(v.string()),
		pronouns: v.optional(v.string()),
		location: v.optional(v.string()),
		website: v.optional(v.string()),
		minecraftUsername: v.optional(v.string()),
		bannerR2Key: v.optional(v.string()),

		// Social links
		socials: v.optional(
			v.object({
				discord: v.optional(v.string()),
				youtube: v.optional(v.string()),
				tiktok: v.optional(v.string()),
				instagram: v.optional(v.string()),
				bluesky: v.optional(v.string()),
				twitter: v.optional(v.string()),
				twitch: v.optional(v.string()),
				github: v.optional(v.string()),
			}),
		),

		// Trust signals
		isVerified: v.optional(v.boolean()), // blue-check
		verifiedAt: v.optional(v.number()),
		isCreator: v.optional(v.boolean()), // unlocks creator tier features
		badges: v.optional(v.array(v.string())), // ['early_supporter', 'staff', ...]

		// Privacy
		showEmail: v.optional(v.boolean()),
		showOnlineStatus: v.optional(v.boolean()),

		// Cached counts (for fast profile-header render)
		followerCount: v.optional(v.number()),
		followingCount: v.optional(v.number()),
		projectCount: v.optional(v.number()),
		serverCount: v.optional(v.number()),

		updatedAt: v.number(),
	})
		.index('by_user', ['userId'])
		.index('by_verified', ['isVerified'])
		.index('by_creator', ['isCreator']),

	organizationProfiles: defineTable({
		organizationId: v.string(),
		about: v.optional(v.string()),
		website: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		bannerR2Key: v.optional(v.string()),
		updatedAt: v.number(),
		updatedBy: v.string(),
	}).index('by_organization', ['organizationId']),

	favourites: defineTable({
		userId: v.string(),
		targetType: v.union(v.literal('server'), v.literal('project')),
		serverId: v.optional(v.id('servers')),
		projectId: v.optional(v.id('projects')),
		createdAt: v.number(),
	})
		.index('by_user', ['userId', 'createdAt'])
		.index('by_user_server', ['userId', 'serverId'])
		.index('by_user_project', ['userId', 'projectId'])
		.index('by_server', ['serverId'])
		.index('by_project', ['projectId']),

	analyticsEvents: defineTable({
		targetType: v.union(
			v.literal('server'),
			v.literal('project'),
			v.literal('organization'),
			v.literal('profile'),
		),
		targetId: v.string(),
		eventType: v.union(
			v.literal('view'),
			v.literal('ip_copy'),
			v.literal('download'),
			v.literal('outbound_click'),
			v.literal('share'),
		),
		userId: v.optional(v.string()),
		referrer: v.optional(v.string()),
		dayKey: v.string(),
		createdAt: v.number(),
	})
		.index('by_target', ['targetType', 'targetId', 'createdAt'])
		.index('by_target_day', ['targetType', 'targetId', 'dayKey'])
		.index('by_event', ['eventType', 'createdAt'])
		.index('by_created', ['createdAt']),

	// ===========================================================================
	// ACTIVITY LOG (Public feed of user actions)
	// ===========================================================================
	activityLog: defineTable({
		userId: v.string(),
		type: v.union(
			v.literal('server_added'),
			v.literal('server_updated'),
			v.literal('review_added'),
			v.literal('collection_created'),
			v.literal('project_added'),
			v.literal('project_updated'),
			v.literal('version_released'),
		),
		// Polymorphic reference
		targetId: v.optional(v.string()), // serverId, contentId, etc.
		targetName: v.optional(v.string()), // Denormalized name for display
		targetSlug: v.optional(v.string()), // For linking
		metadata: v.optional(v.any()), // Extra context (e.g. rating)
		createdAt: v.number(),
	})
		.index('by_user', ['userId', 'createdAt'])
		.index('by_user_type', ['userId', 'type'])
		.index('by_created', ['createdAt']),

	// ===========================================================================
	// SUPPORT TIERS (User-configured "Support Me" options)
	// ===========================================================================
	supportTiers: defineTable({
		userId: v.string(), // The creator receiving support
		enabled: v.boolean(),
		externalUrl: v.optional(v.string()), // Link to Ko-fi, Patreon, etc.
		tiers: v.array(
			v.object({
				label: v.string(), // e.g. "Supporter", "Pro", "Legend"
				amount: v.number(), // e.g. 3, 5, 10
				description: v.optional(v.string()),
			}),
		),
		updatedAt: v.number(),
	}).index('by_user', ['userId']),

	// ===========================================================================
	// GAME VERSIONS
	// ===========================================================================
	gameVersions: defineTable({
		version: v.string(), // e.g. "1.21.60"
		isActive: v.boolean(), // whether to show in version pickers
		createdAt: v.number(),
	})
		.index('by_version', ['version'])
		.index('by_active', ['isActive']),
}
