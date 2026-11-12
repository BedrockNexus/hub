/**
 * One status for a listing in the moderation tables, worked out from the
 * three fields that describe it: where it is in its life (draft, under
 * review, published), the moderation decision, and the latest submission's
 * review. Anything waiting for a moderator is a separate note.
 */

export const CONTENT_STATUSES = [
	'live',
	'awaiting_review',
	'changes_requested',
	'draft',
	'unpublished',
	'flagged',
	'rejected',
	'archived',
] as const
export type ContentStatusKey = (typeof CONTENT_STATUSES)[number]

export const CONTENT_STATUS_LABELS: Record<ContentStatusKey, string> = {
	live: 'Live',
	awaiting_review: 'Awaiting review',
	changes_requested: 'Changes requested',
	draft: 'Draft',
	unpublished: 'Unpublished',
	flagged: 'Flagged',
	rejected: 'Rejected',
	archived: 'Archived',
}

export interface ContentStatusInput {
	lifecycle: 'draft' | 'under_review' | 'published' | 'archived'
	moderation?: 'approved' | 'pending' | 'flagged' | 'rejected'
	submission?: 'pending' | 'changes_requested' | 'approved' | 'rejected'
	/** The listing has been public before. */
	wasPublished: boolean
	/** A release of the live listing waiting for its own review. */
	pendingVersion?: string
	/** When the waiting submission or release was sent. */
	waitingSince?: number
}

export interface ContentStatus {
	key: ContentStatusKey
	label: string
	/** A second line, such as "Update in review". */
	note?: string
	/** Something here is waiting for a moderator. */
	needsReview: boolean
	waitingSince?: number
}

function status(
	key: ContentStatusKey,
	extra: Partial<Omit<ContentStatus, 'key' | 'label'>> = {},
): ContentStatus {
	return {
		key,
		label: CONTENT_STATUS_LABELS[key],
		needsReview: false,
		...extra,
	}
}

function liveStatus(input: ContentStatusInput) {
	if (input.submission === 'pending') {
		return status('live', {
			note: 'Update in review',
			needsReview: true,
			waitingSince: input.waitingSince,
		})
	}
	if (input.pendingVersion) {
		return status('live', {
			note: `Version ${input.pendingVersion} in review`,
			needsReview: true,
			waitingSince: input.waitingSince,
		})
	}
	if (input.submission === 'changes_requested') {
		return status('live', { note: 'Update sent back' })
	}
	return status('live')
}

/** The first of these that applies. */
export function contentStatus(input: ContentStatusInput): ContentStatus {
	if (input.lifecycle === 'archived') {
		return status('archived')
	}
	if (input.moderation === 'flagged') {
		return status('flagged', { note: 'Hidden from listings' })
	}
	if (input.moderation === 'rejected') {
		return status('rejected')
	}
	if (input.lifecycle === 'published') {
		return liveStatus(input)
	}
	if (input.submission === 'pending' || input.lifecycle === 'under_review') {
		return status('awaiting_review', {
			needsReview: true,
			waitingSince: input.waitingSince,
		})
	}
	if (input.submission === 'changes_requested') {
		return status('changes_requested', { note: 'Sent back to the creator' })
	}
	return status(input.wasPublished ? 'unpublished' : 'draft')
}
