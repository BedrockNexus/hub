import type { Infer } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type {
	listingTargetType,
	notificationKind,
} from '../schemas/social'
import type { FollowTarget } from './follows'

/**
 * Notifications (roadmap Phase 2). Something happens once, as an event with a
 * stable key; it then fans out to everyone who follows any of its audiences,
 * one notification per person however many of those they follow.
 *
 * Events are raised only from the moment something becomes public, never
 * from backfills:
 *
 * - a project release reaches the CDN    -> projects/artifactValidation.ts
 * - a plugin release is published        -> plugins/publishing/model.ts
 * - a listing is first published         -> lib/activity.ts, plugins/publishing/model.ts
 */

export type NotificationKind = Infer<typeof notificationKind>
export type SubjectType = Infer<typeof listingTargetType>

export interface NotificationEvent {
	key: string
	kind: NotificationKind
	subjectType: SubjectType
	subjectId: string
	version?: string
	/** Followers of these are told. */
	audiences: FollowTarget[]
	/** Never told, e.g. the people who published it. */
	excludeUserIds: string[]
}

/** Raises the event once; repeated calls with the same key do nothing. */
export async function raiseNotificationEvent(
	ctx: MutationCtx,
	event: NotificationEvent,
) {
	const existing = await ctx.db
		.query('notificationEvents')
		.withIndex('by_key', (q) => q.eq('key', event.key))
		.unique()
	if (existing) return
	await ctx.db.insert('notificationEvents', {
		key: event.key,
		createdAt: Date.now(),
	})
	if (event.audiences.length === 0) return
	await ctx.scheduler.runAfter(
		0,
		internal.functions.social.notifications.fanOut,
		{ event, audienceIndex: 0, cursor: null },
	)
}

export async function getPreferences(
	ctx: QueryCtx | MutationCtx,
	userId: string,
): Promise<Doc<'notificationPreferences'> | null> {
	return ctx.db
		.query('notificationPreferences')
		.withIndex('by_userId', (q) => q.eq('userId', userId))
		.unique()
}

function newToken() {
	return Array.from({ length: 32 }, () =>
		Math.floor(Math.random() * 36).toString(36),
	).join('')
}

/** The person's settings, created with the defaults on first use. */
export async function ensurePreferences(
	ctx: MutationCtx,
	userId: string,
): Promise<Doc<'notificationPreferences'>> {
	const existing = await getPreferences(ctx, userId)
	if (existing) return existing
	const id = await ctx.db.insert('notificationPreferences', {
		userId,
		disabledKinds: [],
		digest: 'off',
		instantAlertEmails: true,
		unsubscribeToken: newToken(),
		updatedAt: Date.now(),
	})
	const created = await ctx.db.get(id)
	if (!created) throw new Error('Could not save notification settings')
	return created
}

/**
 * Delivers one notification unless the person already has it or switched
 * that kind off. Returns whether it was delivered.
 */
export async function deliverNotification(
	ctx: MutationCtx,
	userId: string,
	event: Pick<
		NotificationEvent,
		'key' | 'kind' | 'subjectType' | 'subjectId' | 'version'
	> & { relatedType?: SubjectType; relatedId?: string },
	preferences?: Doc<'notificationPreferences'> | null,
): Promise<boolean> {
	const prefs =
		preferences === undefined ? await getPreferences(ctx, userId) : preferences
	if (prefs?.disabledKinds.includes(event.kind)) return false
	const existing = await ctx.db
		.query('notifications')
		.withIndex('by_userId_and_eventKey', (q) =>
			q.eq('userId', userId).eq('eventKey', event.key),
		)
		.first()
	if (existing) return false
	await ctx.db.insert('notifications', {
		userId,
		kind: event.kind,
		eventKey: event.key,
		subjectType: event.subjectType,
		subjectId: event.subjectId,
		version: event.version,
		relatedType: event.relatedType,
		relatedId: event.relatedId,
		createdAt: Date.now(),
	})
	return true
}

/** The listing's owner as a follow audience. */
export function ownerAudience(listing: {
	ownerType: 'user' | 'organization'
	ownerId: string
}): FollowTarget {
	return { targetType: listing.ownerType, targetId: listing.ownerId }
}
