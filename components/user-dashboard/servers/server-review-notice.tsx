'use client'
import { useQuery } from 'convex/react'
import { ListingReviewNotice } from '@/components/user-dashboard/listing-review-state'
import { api } from '@/convex/_generated/api'
import { creatorListingState } from '@/lib/creator-listing-state'

/**
 * Moderator feedback for a server, shown above every settings section. The
 * editor sidebar also shows it, but that sidebar is collapsed on phones.
 */
export function ServerReviewNotice({ id }: { id: string }) {
	const server = useQuery(api.functions.servers.servers.getForEdit, { id })
	if (!server) {
		return null
	}
	const state = creatorListingState(server)
	const needsAction =
		state.review === 'changes_requested' ||
		state.review === 'rejected' ||
		state.publication === 'flagged'
	if (!(needsAction && state.reason)) {
		return null
	}
	return (
		<ListingReviewNotice
			listing={server}
			submitStep="use the submit button in the server menu"
		/>
	)
}
