import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import {
	internalMutation,
	mutation,
	query,
} from '../../_generated/server'
import { authComponent } from '../../auth'
import { authedMutation, authedQuery } from '../../lib/functions'
import {
	deliverNotification,
	ensurePreferences,
	getPreferences,
} from '../../lib/notifications'
import { ownerRecipients } from '../../lib/ownerRecipients'
import { dependentProjects } from '../../lib/releaseDependencies'
import { enforceRateLimit } from '../../lib/rateLimits'
import { summarizeTarget } from '../../lib/targetSummaries'
import {
	digestFrequency,
	followTargetType,
	listingTargetType,
	notificationKind,
} from '../../schemas/social'

/**
 * The bell, the notifications feed and notification settings (roadmap
 * Phase 2). Events are raised by lib/notifications.ts and fan out here.
 */

const FAN_OUT_BATCH = 200
const MAX_PAGE_SIZE = 50
const UNREAD_CAP = 100
const MARK_BATCH = 200
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const EVENT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000
const PURGE_BATCH = 500

const eventValidator = v.object({
	key: v.string(),
	kind: notificationKind,
	subjectType: listingTargetType,
	subjectId: v.string(),
	version: v.optional(v.string()),
	audiences: v.array(
		v.object({ targetType: followTargetType, targetId: v.string() }),
	),
	excludeUserIds: v.array(v.string()),
})

// =============================================================================
// FAN-OUT
// =============================================================================

/** Delivers an event to one page of one audience's followers, then continues. */
export const fanOut = internalMutation({
	args: {
		event: eventValidator,
		audienceIndex: v.number(),
		cursor: v.union(v.string(), v.null()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { event } = args
		const audience = event.audiences[args.audienceIndex]
		if (!audience) return null

		const page = await ctx.db
			.query('follows')
			.withIndex('by_targetType_and_targetId', (q) =>
				q
					.eq('targetType', audience.targetType)
					.eq('targetId', audience.targetId),
			)
			.paginate({ cursor: args.cursor, numItems: FAN_OUT_BATCH })

		const excluded = new Set(event.excludeUserIds)
		for (const follow of page.page) {
			if (excluded.has(follow.userId)) continue
			await deliverNotification(ctx, follow.userId, event)
		}

		const next = page.isDone
			? { audienceIndex: args.audienceIndex + 1, cursor: null }
			: { audienceIndex: args.audienceIndex, cursor: page.continueCursor }
		if (next.audienceIndex < event.audiences.length) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.social.notifications.fanOut,
				{ event, ...next },
			)
		}
		return null
	},
})

/**
 * A release with breaking changes is public: tell the people who manage
 * listings whose current release depends on it.
 */
export const alertDependents = internalMutation({
	args: { versionId: v.id('projectVersions') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version?.breakingChanges) return null
		for (const dependent of await dependentProjects(ctx, version.projectId)) {
			for (const userId of await ownerRecipients(ctx, dependent)) {
				await deliverNotification(ctx, userId, {
					key: `breaking:${version._id}:${dependent._id}`,
					kind: 'dependency_breaking',
					subjectType: 'project',
					subjectId: version.projectId,
					version: version.version,
					relatedType: 'project',
					relatedId: dependent._id,
				})
			}
		}
		return null
	},
})

// =============================================================================
// BELL AND FEED
// =============================================================================

/** Unread notifications, capped: the bell shows "99+" past the cap. */
export const unreadCount = query({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) return 0
		const unread = await ctx.db
			.query('notifications')
			.withIndex('by_userId_and_readAt', (q) =>
				q.eq('userId', user._id).eq('readAt', undefined),
			)
			.take(UNREAD_CAP)
		return unread.length
	},
})

/**
 * The caller's notifications, newest first, with what each is about. The
 * subject is null when it is gone or no longer public; the UI skips those.
 */
export const listMine = authedQuery({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('notifications')
			.withIndex('by_userId_and_createdAt', (q) =>
				q.eq('userId', ctx.user._id),
			)
			.order('desc')
			.paginate({
				...args.paginationOpts,
				numItems: Math.min(args.paginationOpts.numItems, MAX_PAGE_SIZE),
			})
		const page = await Promise.all(
			result.page.map(async (row) => ({
				_id: row._id,
				kind: row.kind,
				version: row.version,
				readAt: row.readAt,
				createdAt: row.createdAt,
				subject: await summarizeTarget(ctx, {
					targetType: row.subjectType,
					targetId: row.subjectId,
				}),
				related:
					row.relatedType && row.relatedId
						? await summarizeTarget(ctx, {
								targetType: row.relatedType,
								targetId: row.relatedId,
							})
						: null,
			})),
		)
		return { ...result, page }
	},
})

export const markRead = authedMutation({
	args: { notificationIds: v.array(v.id('notifications')) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now()
		for (const id of args.notificationIds.slice(0, MARK_BATCH)) {
			const row = await ctx.db.get(id)
			if (row && row.userId === ctx.user._id && row.readAt === undefined) {
				await ctx.db.patch(id, { readAt: now })
			}
		}
		return null
	},
})

/** Marks a batch read; returns true while more unread remain. */
export const markAllRead = authedMutation({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const unread = await ctx.db
			.query('notifications')
			.withIndex('by_userId_and_readAt', (q) =>
				q.eq('userId', ctx.user._id).eq('readAt', undefined),
			)
			.take(MARK_BATCH + 1)
		const now = Date.now()
		for (const row of unread.slice(0, MARK_BATCH)) {
			await ctx.db.patch(row._id, { readAt: now })
		}
		return unread.length > MARK_BATCH
	},
})

// =============================================================================
// PREFERENCES
// =============================================================================

const preferencesValidator = v.object({
	disabledKinds: v.array(notificationKind),
	digest: digestFrequency,
	instantAlertEmails: v.boolean(),
})

export const getMyPreferences = authedQuery({
	args: {},
	returns: preferencesValidator,
	handler: async (ctx) => {
		const prefs = await getPreferences(ctx, ctx.user._id)
		return {
			disabledKinds: prefs?.disabledKinds ?? [],
			digest: prefs?.digest ?? 'off',
			instantAlertEmails: prefs?.instantAlertEmails ?? true,
		}
	},
})

export const updateMyPreferences = authedMutation({
	args: preferencesValidator.fields,
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(
			ctx,
			'followMutation',
			ctx.user._id,
			'Too many changes. Please wait before trying again.',
		)
		const prefs = await ensurePreferences(ctx, ctx.user._id)
		await ctx.db.patch(prefs._id, {
			disabledKinds: [...new Set(args.disabledKinds)],
			digest: args.digest,
			instantAlertEmails: args.instantAlertEmails,
			// Starting a digest covers what arrives from now on, not the backlog.
			lastDigestAt:
				args.digest !== 'off' && prefs.digest === 'off'
					? Date.now()
					: prefs.lastDigestAt,
			updatedAt: Date.now(),
		})
		return null
	},
})

/**
 * Turns off email from the link in a digest. No sign-in: the token is the
 * credential, and it only ever switches email off.
 */
export const unsubscribe = mutation({
	args: { token: v.string() },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		if (args.token.length !== 32) return false
		const prefs = await ctx.db
			.query('notificationPreferences')
			.withIndex('by_unsubscribeToken', (q) =>
				q.eq('unsubscribeToken', args.token),
			)
			.unique()
		if (!prefs) return false
		await ctx.db.patch(prefs._id, {
			digest: 'off',
			instantAlertEmails: false,
			updatedAt: Date.now(),
		})
		return true
	},
})

// =============================================================================
// RETENTION
// =============================================================================

/** Daily: notifications older than 90 days, event keys older than 180. */
export const purgeOld = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const now = Date.now()
		const old = await ctx.db
			.query('notifications')
			.withIndex('by_createdAt', (q) => q.lt('createdAt', now - RETENTION_MS))
			.take(PURGE_BATCH)
		for (const row of old) await ctx.db.delete(row._id)
		const oldEvents = await ctx.db
			.query('notificationEvents')
			.withIndex('by_createdAt', (q) =>
				q.lt('createdAt', now - EVENT_RETENTION_MS),
			)
			.take(PURGE_BATCH)
		for (const row of oldEvents) await ctx.db.delete(row._id)
		if (old.length === PURGE_BATCH || oldEvents.length === PURGE_BATCH) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.social.notifications.purgeOld,
				{},
			)
		}
		return null
	},
})
