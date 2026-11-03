import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { env, type MutationCtx } from '../_generated/server'

export type AnnouncementKind = Doc<'discordAnnouncements'>['kind']

function enabled() {
	return (
		env.DISCORD_ANNOUNCEMENTS_ENABLED === 'true' &&
		Boolean(env.DISCORD_ANNOUNCEMENTS_WEBHOOK_URL)
	)
}

/** Called only on the first publication transition, never from a backfill. */
export async function stageAnnouncement(
	ctx: MutationCtx,
	kind: AnnouncementKind,
	targetId: string,
) {
	if (!enabled()) return
	const key = `${kind}:${targetId}`
	const existing = await ctx.db
		.query('discordAnnouncements')
		.withIndex('by_key', (q) => q.eq('key', key))
		.unique()
	if (existing) return
	const now = Date.now()
	await ctx.db.insert('discordAnnouncements', {
		key,
		kind,
		targetId,
		status: 'waiting',
		attempts: 0,
		createdAt: now,
		updatedAt: now,
	})
}

/** Approval and artifact promotion wake an already staged first publication. */
export async function wakeAnnouncement(
	ctx: MutationCtx,
	kind: AnnouncementKind,
	targetId: string,
) {
	if (!enabled()) return
	const row = await ctx.db
		.query('discordAnnouncements')
		.withIndex('by_key', (q) => q.eq('key', `${kind}:${targetId}`))
		.unique()
	if (!row || row.status !== 'waiting') return
	await ctx.db.patch(row._id, { status: 'pending', updatedAt: Date.now() })
	await ctx.scheduler.runAfter(
		0,
		internal.functions.site.discordAnnouncementDelivery.deliver,
		{ id: row._id },
	)
}
