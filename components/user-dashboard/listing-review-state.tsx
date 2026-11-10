import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
	type CreatorListingInput,
	creatorListingState,
	PUBLICATION_LABELS,
	type PublicationState,
	REVIEW_LABELS,
	type ReviewState,
} from '@/lib/creator-listing-state'

export function ListingPublicationBadge({
	status,
}: {
	status: PublicationState
}) {
	return (
		<Badge
			variant={
				status === 'flagged' || status === 'rejected'
					? 'destructive'
					: 'outline'
			}
		>
			{PUBLICATION_LABELS[status]}
		</Badge>
	)
}
export function ListingReviewBadge({ status }: { status: ReviewState }) {
	return (
		<Badge variant={status === 'rejected' ? 'destructive' : 'secondary'}>
			{REVIEW_LABELS[status]}
		</Badge>
	)
}
export function ListingReviewNotice({
	listing,
	children,
	submitStep = 'use Submit in the checklist',
}: {
	listing: CreatorListingInput
	children?: React.ReactNode
	/** How the creator sends the listing for review, finishing "then …". */
	submitStep?: string
}) {
	const state = creatorListingState(listing)
	// A draft that has never been sent needs no banner: the General page's
	// "Finish your listing" checklist and the sidebar status say what is next.
	if (
		state.review === 'not_submitted' &&
		state.canSubmit &&
		!state.locked &&
		!state.reason &&
		!listing.hasPendingVersions &&
		!children
	) {
		return null
	}
	let message = `Save your changes, then ${submitStep} to send your listing to the moderators.`
	if (state.locked) {
		message =
			'Your submission is awaiting moderator review. Editing is locked until a moderator decides.'
	} else if (listing.hasPendingVersions) {
		message =
			'A version is awaiting moderator review. Open Versions to track the submission. You can continue editing your listing.'
	} else if (!state.canSubmit) {
		message =
			'This listing cannot be submitted while it is restricted. Contact the moderators about the decision.'
	} else if (state.review === 'changes_requested') {
		message = `Update your saved listing using the moderator feedback, then ${submitStep} to send it again.`
	} else if (state.published) {
		message =
			'Your approved listing stays public. Saved changes remain private until you submit them and a moderator approves them.'
	}
	return (
		<Alert>
			<AlertTitle>{REVIEW_LABELS[state.review]}</AlertTitle>
			<AlertDescription className="space-y-2">
				<p>{message}</p>
				{state.reason ? (
					<p className="whitespace-pre-line">
						<strong>Moderator feedback:</strong> {state.reason}
					</p>
				) : null}
				{children}
			</AlertDescription>
		</Alert>
	)
}
