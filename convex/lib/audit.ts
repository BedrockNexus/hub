import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/**
 * The admin audit log: who changed what, and when. Entries are only ever
 * inserted, never edited or deleted. Record one from every admin mutation
 * that moderates content, changes an account, or alters site configuration,
 * in the same transaction as the change so the two cannot disagree.
 */

type AdminAction = Doc<'adminActions'>

export interface AdminActionEntry {
	/** Dotted name, `<target>.<verb>`: 'project.moderate', 'user.ban', ... */
	action: string
	targetType: AdminAction['targetType']
	targetId: string
	/** The target's name at the time, so the log reads without lookups. */
	targetLabel?: string
	/** Field -> new value (or "old -> new"), as short display text. */
	changes?: Record<string, string | number | boolean | null | undefined>
	reason?: string
}

const CHANGE_VALUE_MAX = 200

export async function recordAdminAction(
	ctx: MutationCtx,
	actorId: string,
	entry: AdminActionEntry,
) {
	const changes = Object.fromEntries(
		Object.entries(entry.changes ?? {})
			.filter(([, value]) => value !== undefined)
			.map(([field, value]) => [field, String(value).slice(0, CHANGE_VALUE_MAX)]),
	)

	await ctx.db.insert('adminActions', {
		actorId,
		action: entry.action,
		targetType: entry.targetType,
		targetId: entry.targetId,
		targetLabel: entry.targetLabel,
		changes: Object.keys(changes).length > 0 ? changes : undefined,
		reason: entry.reason?.trim() || undefined,
		createdAt: Date.now(),
	})
}
