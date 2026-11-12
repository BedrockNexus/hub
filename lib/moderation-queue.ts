import { moderationReviewHref } from '@/lib/admin-review-navigation'

interface QueueRowLink {
	id: string
	type: 'project' | 'server' | 'plugin'
	projectId?: string
	packType?: string
	version?: string
}

/** The review page of one row of the moderation queue. */
export function queueRowHref(row: QueueRowLink) {
	const kind = (
		{ project: 'projects', server: 'servers', plugin: 'plugins' } as const
	)[row.type]
	return moderationReviewHref(kind, row.projectId ?? row.id, {
		projectType: row.packType,
		releaseId: row.version ? row.id : undefined,
	})
}
