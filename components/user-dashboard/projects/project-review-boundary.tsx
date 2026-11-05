'use client'
import { useQuery } from 'convex/react'
import { ListingReviewNotice } from '@/components/user-dashboard/listing-review-state'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { creatorListingState } from '@/lib/creator-listing-state'
export function ProjectReviewBoundary({
	id,
	children,
}: {
	id: Id<'projects'>
	children: React.ReactNode
}) {
	const project = useQuery(api.functions.projects.projects.getForEdit, { id })
	const state = project ? creatorListingState(project) : null
	return (
		<div className="min-w-0 space-y-6">
			{project ? <ListingReviewNotice listing={project} /> : null}
			<fieldset
				className="min-w-0 space-y-6"
				disabled={!project || state?.locked}
			>
				<legend className="sr-only">Listing settings</legend>
				{children}
			</fieldset>
		</div>
	)
}
