'use client'
import { type ComponentProps, type ReactNode, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAdminReviewNavigation } from '@/hooks/use-admin-review-navigation'
import { REVIEW_SECTIONS } from '@/lib/admin-review-navigation'
import { ReviewAssignment, type ReviewContentId } from './review-assignment'
import { SubmissionStatusBadge } from './submission-status'
export function AdminReviewShell({
	header,
	identity,
	actions,
	children,
	note,
	submissionStatus,
	submissionRevision,
	submittedAt,
	server = false,
	versionLabel,
}: {
	header: ReactNode
	identity: { contentId: ReviewContentId; revision: number; pending: boolean }
	actions: ReactNode
	children: ReactNode
	note?: string
	submissionStatus?: ComponentProps<typeof SubmissionStatusBadge>['status']
	submissionRevision?: number
	submittedAt?: number
	server?: boolean
	versionLabel?: string
}) {
	const nav = useAdminReviewNavigation()
	useEffect(() => {
		if (nav.section === 'versions' && nav.releaseId) {
			document
				.getElementById(`release-${nav.releaseId}`)
				?.scrollIntoView({ block: 'nearest' })
		}
	}, [nav.section, nav.releaseId])
	const title =
		REVIEW_SECTIONS.find((section) => section.id === nav.section)?.title ??
		'Overview'
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-6">
			{header}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-5 text-muted-foreground text-sm">
				<SubmissionStatusBadge status={submissionStatus} />
				<span>
					{versionLabel
						? `Reviewing ${versionLabel}`
						: `Submission ${submissionRevision === undefined ? '(legacy)' : `revision ${submissionRevision}`}`}
				</span>
				{submittedAt ? (
					<time dateTime={new Date(submittedAt).toISOString()}>
						{new Date(submittedAt).toLocaleString()}
					</time>
				) : null}
				{versionLabel ? (
					<Button
						onClick={() => nav.selectListing()}
						size="sm"
						variant="outline"
					>
						Review listing
					</Button>
				) : null}
			</div>
			{note ? (
				<div className="border-primary border-l-2 pl-4 text-sm">
					<p className="mb-1 font-medium">Moderator feedback</p>
					<p className="whitespace-pre-wrap text-muted-foreground">
						{note}
					</p>
				</div>
			) : null}
			<section aria-label={title} className="min-w-0 flex-1 space-y-6">
				<h2 className="font-semibold text-lg">
					{server && nav.section === 'versions'
						? 'Server details'
						: title}
				</h2>
				{children}
			</section>
			<aside
				aria-label="Review decision"
				className="sticky bottom-0 z-20 -mx-4 -mb-4 border-t bg-background px-4 py-4 md:-mx-6 md:-mb-6 md:px-6"
				id="review-decision"
				tabIndex={-1}
			>
				<h2 className="sr-only">Review decision</h2>
				<ReviewAssignment key={identity.contentId} {...identity}>
					{actions}
				</ReviewAssignment>
			</aside>
		</div>
	)
}

export function ReviewSectionPanel({
	active,
	children,
}: {
	active: boolean
	children: ReactNode
}) {
	return active ? <div className="space-y-6">{children}</div> : null
}
