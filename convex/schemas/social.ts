import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// =============================================================================
// FOLLOWS, COLLECTIONS AND NOTIFICATIONS (roadmap Phase 2)
// =============================================================================

/** What can be followed. Listings, their owners, and public collections. */
export const followTargetType = v.union(
	v.literal('user'),
	v.literal('organization'),
	v.literal('project'),
	v.literal('server'),
	v.literal('plugin'),
	v.literal('collection'),
)

/** What a collection or library entry can hold. */
export const listingTargetType = v.union(
	v.literal('project'),
	v.literal('server'),
	v.literal('plugin'),
)

export const notificationKind = v.union(
	// A followed listing, or a listing by a followed owner, has a new release.
	v.literal('release'),
	// A followed owner published a new listing.
	v.literal('listing'),
	// A listing yours depends on released breaking changes (Phase 3).
	v.literal('dependency_breaking'),
	// Phase 5: alerts to a server's owners.
	v.literal('server_offline'),
	v.literal('server_online'),
)

export const digestFrequency = v.union(
	v.literal('off'),
	v.literal('daily'),
	v.literal('weekly'),
)

export const tables = {
	// One row per follower and target. Counts live on the target's stats
	// document (lib/follows.ts), never computed from this table on read.
	follows: defineTable({
		userId: v.string(), // Better Auth user ID of the follower
		targetType: followTargetType,
		targetId: v.string(),
		createdAt: v.number(),
	})
		.index('by_userId_and_targetType_and_targetId', [
			'userId',
			'targetType',
			'targetId',
		])
		.index('by_userId_and_createdAt', ['userId', 'createdAt'])
		.index('by_targetType_and_targetId', ['targetType', 'targetId']),

	// How many people follow each target; the source of truth that stats
	// documents, creator listings and collections copy for sorting.
	followerCounts: defineTable({
		targetType: followTargetType,
		targetId: v.string(),
		count: v.number(),
	}).index('by_targetType_and_targetId', ['targetType', 'targetId']),

	// Named lists of listings. Public and unlisted collections can be opened
	// by anyone with the link; only public ones appear on profiles.
	collections: defineTable({
		ownerId: v.string(), // Better Auth user ID
		publicId: v.string(), // stable route reference, `c_...`
		name: v.string(),
		description: v.optional(v.string()),
		visibility: v.union(
			v.literal('public'),
			v.literal('unlisted'),
			v.literal('private'),
		),
		itemCount: v.number(),
		followerCount: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_ownerId_and_updatedAt', ['ownerId', 'updatedAt'])
		.index('by_publicId', ['publicId'])
		.index('by_visibility_and_followerCount', ['visibility', 'followerCount']),

	collectionItems: defineTable({
		collectionId: v.id('collections'),
		targetType: listingTargetType,
		targetId: v.string(),
		note: v.optional(v.string()),
		addedAt: v.number(),
	})
		.index('by_collectionId_and_addedAt', ['collectionId', 'addedAt'])
		.index('by_collectionId_and_targetType_and_targetId', [
			'collectionId',
			'targetType',
			'targetId',
		])
		.index('by_targetType_and_targetId', ['targetType', 'targetId']),

	// Each event fans out once, however often its trigger runs again.
	notificationEvents: defineTable({
		key: v.string(), // e.g. `release:project:<versionId>`
		createdAt: v.number(),
	})
		.index('by_key', ['key'])
		.index('by_createdAt', ['createdAt']),

	// One row per recipient. Display details are resolved when read, so a
	// listing that is renamed or taken down never shows stale or private data.
	notifications: defineTable({
		userId: v.string(),
		kind: notificationKind,
		eventKey: v.string(),
		subjectType: listingTargetType,
		subjectId: v.string(),
		version: v.optional(v.string()), // the release, for `release`
		// For `dependency_breaking`: your listing that depends on the subject.
		relatedType: v.optional(listingTargetType),
		relatedId: v.optional(v.string()),
		readAt: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index('by_userId_and_createdAt', ['userId', 'createdAt'])
		.index('by_userId_and_readAt', ['userId', 'readAt'])
		.index('by_userId_and_eventKey', ['userId', 'eventKey'])
		.index('by_createdAt', ['createdAt']),

	// Missing row = defaults (every kind on, no email digest).
	notificationPreferences: defineTable({
		userId: v.string(),
		disabledKinds: v.array(notificationKind),
		digest: digestFrequency,
		// Owner alerts (Phase 5) by email as they happen.
		instantAlertEmails: v.boolean(),
		lastDigestAt: v.optional(v.number()),
		unsubscribeToken: v.string(),
		updatedAt: v.number(),
	})
		.index('by_userId', ['userId'])
		.index('by_digest', ['digest'])
		.index('by_unsubscribeToken', ['unsubscribeToken']),
}
