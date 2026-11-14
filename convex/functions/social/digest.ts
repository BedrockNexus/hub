import { Resend } from '@convex-dev/resend'
import { render } from '@react-email/render'
import { v } from 'convex/values'
import {
	type DigestItem,
	DigestEmailTemplate,
} from '../../../components/email/digest-email'
import { components, internal } from '../../_generated/api'
import {
	env,
	internalAction,
	internalMutation,
} from '../../_generated/server'
import { authComponent } from '../../auth'
import { summarizeTarget } from '../../lib/targetSummaries'

/**
 * The optional daily or weekly email digest (roadmap Phase 2). Two crons
 * (crons.ts) queue one send per subscriber; each send lists that person's
 * unread notifications since their previous digest. Nothing is sent when
 * there is nothing new, and nobody gets a digest without turning it on.
 */

const resend = new Resend(components.resend, { testMode: false })
const EMAIL_FROM =
	process.env.EMAIL_FROM || 'BedrockNexus <noreply@bedrocknexus.com>'

const QUEUE_BATCH = 100
const MAX_ITEMS = 12
const MAX_SCAN = 100
const WINDOW_MS = {
	daily: 24 * 60 * 60 * 1000,
	weekly: 7 * 24 * 60 * 60 * 1000,
} as const

const frequencyValidator = v.union(v.literal('daily'), v.literal('weekly'))

function siteUrl() {
	return (env.SITE_URL ?? 'https://bedrocknexus.com').replace(/\/$/, '')
}

const KIND_LABEL = {
	release: 'New release',
	listing: 'New listing',
	dependency_breaking: 'Breaking release of a dependency',
	server_offline: 'Server offline',
	server_online: 'Server back online',
} as const

/** Schedules a digest for every subscriber at this frequency, a page at a time. */
export const queue = internalMutation({
	args: {
		frequency: frequencyValidator,
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('notificationPreferences')
			.withIndex('by_digest', (q) => q.eq('digest', args.frequency))
			.paginate({ cursor: args.cursor ?? null, numItems: QUEUE_BATCH })
		for (const prefs of page.page) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.social.digest.send,
				{ userId: prefs.userId, frequency: args.frequency },
			)
		}
		if (!page.isDone) {
			await ctx.scheduler.runAfter(0, internal.functions.social.digest.queue, {
				frequency: args.frequency,
				cursor: page.continueCursor,
			})
		}
		return null
	},
})

const contentValidator = v.union(
	v.null(),
	v.object({
		to: v.string(),
		unsubscribeToken: v.string(),
		items: v.array(
			v.object({ title: v.string(), detail: v.string(), url: v.string() }),
		),
		moreCount: v.number(),
		periodKey: v.string(),
	}),
)

/**
 * What one person's digest says, or null when there is nothing to send.
 * Moves their digest window forward, so a retry never repeats items.
 */
export const prepare = internalMutation({
	args: { userId: v.string(), frequency: frequencyValidator },
	returns: contentValidator,
	handler: async (ctx, args) => {
		const prefs = await ctx.db
			.query('notificationPreferences')
			.withIndex('by_userId', (q) => q.eq('userId', args.userId))
			.unique()
		if (!prefs || prefs.digest !== args.frequency) return null
		const user = (await authComponent.getAnyUserById(ctx, args.userId)) as {
			email?: string
			emailVerified?: boolean
			banned?: boolean | null
		} | null
		if (!user?.email || !user.emailVerified || user.banned) return null

		const now = Date.now()
		const since = prefs.lastDigestAt ?? now - WINDOW_MS[args.frequency]
		const recent = await ctx.db
			.query('notifications')
			.withIndex('by_userId_and_createdAt', (q) =>
				q.eq('userId', args.userId).gt('createdAt', since),
			)
			.order('desc')
			.take(MAX_SCAN)
		const unread = recent.filter((row) => row.readAt === undefined)
		await ctx.db.patch(prefs._id, { lastDigestAt: now })
		if (unread.length === 0) return null

		const items: DigestItem[] = []
		for (const row of unread) {
			if (items.length >= MAX_ITEMS) break
			const subject = await summarizeTarget(ctx, {
				targetType: row.subjectType,
				targetId: row.subjectId,
			})
			if (!subject) continue
			items.push({
				title: row.version ? `${subject.name} ${row.version}` : subject.name,
				detail: [
					KIND_LABEL[row.kind],
					subject.ownerName
						? `${subject.kind} by ${subject.ownerName}`
						: subject.kind,
				].join(' · '),
				url: `${siteUrl()}${subject.href}`,
			})
		}
		if (items.length === 0) return null
		return {
			to: user.email,
			unsubscribeToken: prefs.unsubscribeToken,
			items,
			moreCount: Math.max(0, unread.length - items.length),
			periodKey: `${args.frequency}:${new Date(now).toISOString().slice(0, 10)}`,
		}
	},
})

export const send = internalAction({
	args: { userId: v.string(), frequency: frequencyValidator },
	returns: v.null(),
	handler: async (ctx, args) => {
		const content = await ctx.runMutation(
			internal.functions.social.digest.prepare,
			args,
		)
		if (!content) return null
		const base = siteUrl()
		const unsubscribeUrl = `${base}/notifications/unsubscribe?token=${content.unsubscribeToken}`
		const template = DigestEmailTemplate({
			siteUrl: base,
			frequency: args.frequency,
			items: content.items,
			moreCount: content.moreCount,
			notificationsUrl: `${base}/dashboard/notifications`,
			settingsUrl: `${base}/dashboard/settings/notifications`,
			unsubscribeUrl,
		})
		const [html, text] = await Promise.all([
			render(template),
			render(template, { plainText: true }),
		])
		const total = content.items.length + content.moreCount
		await resend.sendEmail(ctx, {
			from: EMAIL_FROM,
			to: content.to,
			subject:
				total === 1
					? '1 new update on BedrockNexus'
					: `${total} new updates on BedrockNexus`,
			html,
			text,
			headers: [
				{
					name: 'List-Unsubscribe',
					value: `<${base}/api/notifications/unsubscribe?token=${content.unsubscribeToken}>`,
				},
				{ name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
			],
			idempotencyKey: `digest:${args.userId}:${content.periodKey}`,
		})
		return null
	},
})
