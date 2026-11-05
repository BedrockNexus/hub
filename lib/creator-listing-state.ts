export interface CreatorListingInput {
	status?: string
	visibility?: string
	moderationStatus?: string
	submissionStatus?: string
	submissionReason?: string
	moderationReason?: string
	draftChangesJson?: string
	publishedAt?: number
	hasDraftChanges?: boolean
	releaseStage?: string
	hasPendingVersions?: boolean
	locked?: boolean
}
export const PUBLICATION_LABELS = {
	draft: 'Draft',
	published: 'Published',
	unpublished: 'Unpublished',
	flagged: 'Flagged',
	rejected: 'Rejected',
	archived: 'Archived',
} as const
export const REVIEW_LABELS = {
	not_submitted: 'Not submitted',
	draft_changes: 'Unsubmitted changes',
	pending: 'Awaiting review',
	changes_requested: 'Changes requested',
	approved: 'Approved',
	rejected: 'Rejected',
} as const
export type PublicationState = keyof typeof PUBLICATION_LABELS
export type ReviewState = keyof typeof REVIEW_LABELS
function publicationState(input: CreatorListingInput): PublicationState {
	if (input.status === 'archived') {
		return 'archived'
	}
	if (input.moderationStatus === 'flagged') {
		return 'flagged'
	}
	if (input.moderationStatus === 'rejected') {
		return 'rejected'
	}
	if (input.visibility === 'hidden' || input.visibility === 'suspended') {
		return 'unpublished'
	}
	if (input.status === 'draft' && input.publishedAt) {
		return 'unpublished'
	}
	const publicVisibility =
		!input.visibility || ['public', 'unlisted'].includes(input.visibility)
	const approved =
		input.moderationStatus === 'approved' ||
		(!!input.visibility && !input.moderationStatus)
	if (input.status === 'published') {
		return publicVisibility && approved ? 'published' : 'unpublished'
	}
	return 'draft'
}
function reviewState(
	input: CreatorListingInput,
	locked: boolean,
	hasDraftChanges: boolean,
	publication: PublicationState,
): ReviewState {
	if (locked) {
		return 'pending'
	}
	const releaseReviews: Record<string, string> = {
		changesRequested: 'changes_requested',
		rejected: 'rejected',
		published: 'approved',
	}
	const status =
		input.submissionStatus ?? releaseReviews[input.releaseStage ?? '']
	if (status === 'changes_requested') {
		return 'changes_requested'
	}
	if (status === 'rejected' || publication === 'rejected') {
		return 'rejected'
	}
	if (input.hasPendingVersions) {
		return 'pending'
	}
	if (hasDraftChanges) {
		return 'draft_changes'
	}
	if (status === 'approved' || publication === 'published') {
		return 'approved'
	}
	return 'not_submitted'
}
export function creatorListingState(input: CreatorListingInput) {
	const publication = publicationState(input)
	const activeStage = ['preparing', 'inReview', 'publishing'].includes(
		input.releaseStage ?? '',
	)
	const legacyPending =
		!input.submissionStatus &&
		(!input.moderationStatus || input.moderationStatus === 'pending') &&
		['under_review', 'review'].includes(input.status ?? '')
	const locked =
		!!input.locked ||
		input.submissionStatus === 'pending' ||
		activeStage ||
		legacyPending
	const hasDraftChanges = !!input.draftChangesJson || !!input.hasDraftChanges
	return {
		publication,
		review: reviewState(input, locked, hasDraftChanges, publication),
		locked,
		published: publication === 'published',
		hasDraftChanges,
		canSubmit: !(
			locked ||
			['rejected', 'archived'].includes(publication) ||
			['hidden', 'suspended'].includes(input.visibility ?? '')
		),
		reason: input.submissionReason ?? input.moderationReason,
	}
}

export function creatorSidebarStatus(input: CreatorListingInput) {
	const state = creatorListingState(input)
	if (
		['flagged', 'rejected', 'unpublished', 'archived'].includes(
			state.publication,
		)
	) {
		return state.publication
	}
	if (state.locked) {
		return 'in_review'
	}
	if (state.review === 'changes_requested' || state.review === 'rejected') {
		return state.review
	}
	return state.publication
}
