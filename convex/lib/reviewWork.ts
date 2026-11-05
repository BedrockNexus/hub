import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { AdminActionEntry } from './audit'
export async function reviewWork(
	ctx: MutationCtx,
	actorId: string,
	entry: AdminActionEntry,
) {
	if (
		!/\.(moderate|approve|reject|changes|requestChanges|flag|unpublish|review)$/.test(
			entry.action,
		)
	)
		return
	let id = entry.targetId
	if (entry.targetType === 'pluginRelease') {
		const key = ctx.db.normalizeId('pluginReleases', id)
		const row = key ? await ctx.db.get(key) : null
		if (!row) return
		id = row.projectId
	}
	if (entry.targetType === 'projectVersion') {
		const key = ctx.db.normalizeId('projectVersions', id)
		const row = key ? await ctx.db.get(key) : null
		if (!row) return
		id = row.projectId
	}
	const key =
		ctx.db.normalizeId('servers', id) ??
		ctx.db.normalizeId('projects', id) ??
		ctx.db.normalizeId('plugins', id)
	if (!key) return
	const item = await ctx.db.get(key)
	if (!item) return
	const claim = await ctx.db
		.query('reviewClaims')
		.withIndex('by_contentId', (q) =>
			q.eq(
				'contentId',
				entry.targetType === 'projectVersion' ? entry.targetId : id,
			),
		)
		.unique()
	if (claim && claim.assignedTo !== actorId)
		throw new ConvexError(
			'This submission is assigned to another moderator',
		)
	if (claim) await ctx.db.delete(claim._id)
	const userId = 'registeredBy' in item ? item.registeredBy : item.createdBy
	await ctx.db.insert('reviewNotices', {
		userId,
		contentId: id,
		contentType:
			'repositoryId' in item
				? 'plugin'
				: 'type' in item
					? 'project'
					: 'server',
		title:
			entry.action === 'release.review'
				? `${entry.targetLabel ?? 'Release'}: ${entry.changes?.reviewStatus ?? 'updated'}`
				: entry.action.endsWith('.moderate')
					? `Review decision: ${entry.changes?.reviewStatus ?? entry.changes?.moderationStatus ?? entry.changes?.status ?? 'updated'}`
					: ((
							{
								approve: 'Approved for publication',
								reject: 'Submission rejected',
								requestChanges: 'Changes requested',
								changes: 'Changes requested',
								flag: 'Listing flagged',
								unpublish: 'Listing unpublished',
							} as Record<string, string>
						)[entry.action.split('.').pop()!] ?? 'Review updated'),
		reason: entry.reason,
		read: false,
		createdAt: Date.now(),
	})
}
