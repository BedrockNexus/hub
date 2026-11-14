import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// =============================================================================
// SITE-WIDE TABLES (Settings, Profiles, Activity, and Aggregates)
// =============================================================================

export const tables = {
	// One first-publication announcement per listing, including delivery history.
	discordAnnouncements: defineTable({
		key: v.string(),
		kind: v.union(v.literal('server'), v.literal('project'), v.literal('plugin')),
		targetId: v.string(),
		status: v.union(v.literal('waiting'), v.literal('pending'), v.literal('sending'), v.literal('sent'), v.literal('failed'), v.literal('skipped')),
		attempts: v.number(),
		leaseUntil: v.optional(v.number()),
		messageId: v.optional(v.string()),
		lastError: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index('by_key', ['key']),
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
		location: v.optional(v.string()),
		website: v.optional(v.string()),
		minecraftUsername: v.optional(v.string()),
		// The Bedrock version the user plays, e.g. "1.21.80". Marks compatible
		// releases and is the default version filter.
		minecraftVersion: v.optional(v.string()),
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

		updatedAt: v.number(),
	}).index('by_user', ['userId']),

	organizationProfiles: defineTable({
		organizationId: v.string(),
		about: v.optional(v.string()),
		website: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		bannerR2Key: v.optional(v.string()),
		updatedAt: v.number(),
		updatedBy: v.string(),
	}).index('by_organization', ['organizationId']),

	// Which documents embed which editor uploads (see lib/editorMedia.ts).
	editorMediaReferences: defineTable({
		key: v.string(),
		sourceTable: v.union(
			v.literal('servers'),
			v.literal('projects'),
			v.literal('projectVersions'),
		),
		sourceId: v.string(),
		createdAt: v.number(),
	})
		.index('by_key', ['key'])
		.index('by_key_and_source', ['key', 'sourceTable', 'sourceId']),

	// The private library (functions/social/library.ts): what a user saved to
	// find again or install with the launcher. Never shown to anyone else.
	favourites: defineTable({
		userId: v.string(),
		targetType: v.union(
			v.literal('server'),
			v.literal('project'),
			v.literal('plugin'),
		),
		serverId: v.optional(v.id('servers')),
		projectId: v.optional(v.id('projects')),
		pluginId: v.optional(v.id('plugins')),
		createdAt: v.number(),
	})
		.index('by_user', ['userId', 'createdAt'])
		.index('by_user_server', ['userId', 'serverId'])
		.index('by_user_project', ['userId', 'projectId'])
		.index('by_user_plugin', ['userId', 'pluginId'])
		.index('by_server', ['serverId'])
		.index('by_project', ['projectId'])
		.index('by_plugin', ['pluginId']),

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
	// ORGANIZATION AUDIT HISTORY (lib/orgAudit.ts)
	// What happened to an organization's listings and members, newest first,
	// for its members. Append-only.
	// ===========================================================================
	organizationAuditEvents: defineTable({
		organizationId: v.string(),
		// Who did it; missing for automatic changes and membership changes
		// made through Better Auth.
		actorId: v.optional(v.string()),
		action: v.union(
			v.literal('listing.created'),
			v.literal('listing.published'),
			v.literal('listing.unpublished'),
			v.literal('listing.moderated'),
			v.literal('listing.deleted'),
			v.literal('listing.transferred_in'),
			v.literal('listing.transferred_out'),
			v.literal('member.added'),
			v.literal('member.removed'),
			v.literal('member.role_changed'),
		),
		targetType: v.union(
			v.literal('project'),
			v.literal('server'),
			v.literal('plugin'),
			v.literal('member'),
		),
		targetId: v.string(),
		targetLabel: v.string(), // name at the time
		detail: v.optional(v.string()), // e.g. "approved", "admin"
		createdAt: v.number(),
	}).index('by_organizationId_and_createdAt', ['organizationId', 'createdAt']),

	// ===========================================================================
	// DOWNLOAD EVENTS (append-only; see lib/downloadEvents.ts)
	// One row per accepted download redirect, counted or not, so download
	// totals can be audited and Creator Rewards (Phase 4) has real history to
	// test fraud rules against. Never updated; purged after 400 days.
	// ===========================================================================
	downloadEvents: defineTable({
		targetType: v.union(v.literal('project'), v.literal('plugin')),
		projectId: v.optional(v.id('projects')),
		pluginId: v.optional(v.id('plugins')),
		versionId: v.string(),
		// `user:<id>` when signed in, otherwise `client:<salted hash>`.
		requesterKey: v.string(),
		source: v.union(v.literal('website'), v.literal('api')),
		counted: v.boolean(),
		createdAt: v.number(),
	})
		.index('by_projectId_and_createdAt', ['projectId', 'createdAt'])
		.index('by_pluginId_and_createdAt', ['pluginId', 'createdAt'])
		.index('by_requesterKey_and_createdAt', ['requesterKey', 'createdAt'])
		.index('by_createdAt', ['createdAt']),

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
	// ADMIN ACTIONS (append-only audit log; see lib/audit.ts)
	// ===========================================================================
	adminActions: defineTable({
		actorId: v.string(), // Better Auth user ID of the admin
		action: v.string(), // e.g. 'project.moderate', 'user.ban'
		targetType: v.union(
			v.literal('server'),
			v.literal('project'),
			v.literal('projectVersion'),
			v.literal('user'),
			v.literal('serverSoftware'),
			v.literal('setting'),
			v.literal('plugin'),
			v.literal('pluginPublishingDraft'),
			v.literal('pluginRelease'),
			v.literal('pluginCategory'),
			v.literal('pluginWorkflowTemplate'),
			v.literal('pick'),
		),
		targetId: v.string(),
		targetLabel: v.optional(v.string()), // name at the time, for display
		// What changed, as short display strings.
		changes: v.optional(v.record(v.string(), v.string())),
		reason: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index('by_targetType_and_targetId', ['targetType', 'targetId'])
		.index('by_actorId', ['actorId']),

	// ===========================================================================
	// PICKS (editorial choices by admins; see functions/site/picks.ts)
	// Shown in their own clearly labelled places and never read by any
	// ranking or listing order.
	// ===========================================================================
	picks: defineTable({
		targetType: v.union(v.literal('server'), v.literal('project')),
		serverId: v.optional(v.id('servers')),
		projectId: v.optional(v.id('projects')),
		note: v.string(), // why it was picked, shown publicly
		pickedBy: v.string(), // Better Auth user ID of the admin
		pickedAt: v.number(),
	})
		.index('by_pickedAt', ['pickedAt'])
		.index('by_serverId', ['serverId'])
		.index('by_projectId', ['projectId']),

	// ===========================================================================
	// CREATOR LISTINGS (who can be found by name; see lib/creatorListings.ts)
	// ===========================================================================
	creatorListings: defineTable({
		ownerType: v.union(v.literal('user'), v.literal('organization')),
		ownerId: v.string(), // Better Auth user or organization ID
		slug: v.string(), // username or organization slug
		name: v.string(),
		searchText: v.string(),
		pictureUrl: v.optional(v.string()), // avatar or logo on the CDN
		// Public items only, as shown on the owner's page.
		serverCount: v.number(),
		projectCount: v.number(),
		pluginCount: v.number(),
		// Refreshed hourly by site/creators:recomputeRanks; the order of
		// /creators and /organizations (formula in lib/creatorRank.ts).
		totalDownloads: v.optional(v.number()),
		avgPlayers7d: v.optional(v.number()),
		rankScore: v.optional(v.number()),
		// Public follows of this user or organization (lib/follows.ts).
		followerCount: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index('by_ownerType_and_ownerId', ['ownerType', 'ownerId'])
		.index('by_ownerType_and_rankScore', ['ownerType', 'rankScore'])
		.searchIndex('search_text', {
			searchField: 'searchText',
			filterFields: ['ownerType'],
		}),

	// ===========================================================================
	// SITE AGGREGATES (precomputed homepage numbers; see site/aggregates.ts)
	// ===========================================================================
	siteAggregates: defineTable({
		key: v.literal('home'),
		servers: v.number(),
		onlinePlayers: v.number(),
		projects: v.number(),
		// Public, published plugins. Missing until the first refresh after it
		// was added.
		plugins: v.optional(v.number()),
		regions: v.array(v.string()),
		updatedAt: v.number(),
	}).index('by_key', ['key']),

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
