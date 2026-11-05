import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const contentType = v.union(
	v.literal('server'),
	v.literal('project'),
	v.literal('plugin'),
)
export const snapshotField = v.object({
	key: v.string(),
	label: v.string(),
	kind: v.union(
		v.literal('text'),
		v.literal('description'),
		v.literal('image'),
		v.literal('gallery'),
		v.literal('release'),
	),
	value: v.string(),
})
export const tables = {
	reviewClaims: defineTable({
		contentId: v.string(),
		revision: v.number(),
		assignedTo: v.string(),
		claimedAt: v.number(),
	}).index('by_contentId', ['contentId']),
	reviewNotices: defineTable({
		userId: v.string(),
		contentId: v.string(),
		contentType,
		title: v.string(),
		reason: v.optional(v.string()),
		read: v.boolean(),
		createdAt: v.number(),
	}).index('by_userId', ['userId']),

	// Append-only: decisions reference the existing immutable admin audit record.
	moderationEvents: defineTable({
		contentId: v.string(),
		contentType,
		kind: v.union(
			v.literal('submission'),
			v.literal('decision'),
			v.literal('publication'),
		),
		scope: v.union(v.literal('listing'), v.literal('release')),
		action: v.string(),
		actorId: v.optional(v.string()),
		revision: v.optional(v.number()),
		releaseId: v.optional(v.string()),
		label: v.optional(v.string()),
		reason: v.optional(v.string()),
		sourceAuditId: v.optional(v.id('adminActions')),
		before: v.optional(v.array(snapshotField)),
		after: v.optional(v.array(snapshotField)),
		createdAt: v.number(),
	})
		.index('by_contentId_and_createdAt', ['contentId', 'createdAt'])
		.index('by_contentId_and_scope_and_revision', [
			'contentId',
			'scope',
			'revision',
		])
		.index('by_releaseId', ['releaseId'])
		.index('by_sourceAuditId', ['sourceAuditId']),
	// Keep images needed to inspect a historical submission after later edits.
	moderationMediaReferences: defineTable({
		eventId: v.id('moderationEvents'),
		key: v.string(),
	})
		.index('by_key', ['key'])
		.index('by_eventId', ['eventId']),
}
