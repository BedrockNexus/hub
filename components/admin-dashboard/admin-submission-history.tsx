'use client'

import { usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useId, useState } from 'react'
import { SubmissionComparison } from '@/components/admin-dashboard/submission-comparison'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { formatDate } from '@/lib/format'

interface Scope {
	contentId: string
	contentType: 'server' | 'project' | 'plugin'
}
type Event = FunctionReturnType<
	typeof api.functions.moderation.history.list
>['page'][number]

/** The saved comparison for the submission under review, if it is current. */
export function useCurrentComparison(scope: Scope, revision?: number) {
	const current = useQuery(
		api.functions.moderation.history.getCurrentComparison,
		scope,
	)
	if (current === undefined) {
		return undefined
	}
	return current && current.revision === (revision ?? 0) ? current : null
}

/** What this submission changes, field by field. */
export function SubmissionChanges({
	comparison,
}: {
	comparison: ReturnType<typeof useCurrentComparison>
}) {
	if (comparison === undefined) {
		return <Skeleton className="h-40 w-full rounded-lg" />
	}
	if (!comparison) {
		return (
			<p className="text-muted-foreground text-sm">
				No comparison was saved for this revision. The Listing tab shows
				what was submitted.
			</p>
		)
	}
	const count = comparison.fields.length
	return (
		<div className="flex flex-col gap-4">
			{count ? (
				<p className="text-muted-foreground text-sm">
					{count === 1 ? '1 field' : `${count} fields`} changed since
					the approved listing.
				</p>
			) : null}
			<SubmissionComparison comparison={comparison} />
		</div>
	)
}

function EventComparison({ event, scope }: { event: Event; scope: Scope }) {
	const comparison = useQuery(
		api.functions.moderation.history.getComparison,
		{ ...scope, eventId: event._id },
	)
	if (comparison === undefined) {
		return <Skeleton className="h-24 w-full" />
	}
	if (!comparison) {
		return (
			<p className="text-muted-foreground text-sm">
				A comparison was not recorded for this decision.
			</p>
		)
	}
	return <SubmissionComparison comparison={comparison} />
}

function HistoryEvent({ event, scope }: { event: Event; scope: Scope }) {
	const [open, setOpen] = useState(false)
	const panelId = useId()
	return (
		<li className="grid grid-cols-[20px_minmax(0,1fr)] gap-3.5 pb-5">
			<span
				aria-hidden
				className="mt-1.5 size-2.5 rounded-full bg-muted-foreground/60"
			/>
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<h3 className="font-semibold text-sm">{event.title}</h3>
						<p className="text-[13px] text-muted-foreground">
							{event.actor} <span aria-hidden>·</span>{' '}
							<time
								dateTime={new Date(
									event.createdAt,
								).toISOString()}
							>
								{formatDate(event.createdAt, {
									month: 'short',
									hour: 'numeric',
									minute: '2-digit',
								})}
							</time>
							{event.label ? ` · ${event.label}` : ''}
						</p>
					</div>
					{event.hasComparison ? (
						<Button
							aria-controls={panelId}
							aria-expanded={open}
							onClick={() => setOpen((value) => !value)}
							variant="outline"
						>
							{open ? 'Hide changes' : 'Show changes'}
						</Button>
					) : null}
				</div>
				{event.reason ? (
					<p className="mt-1.5 whitespace-pre-wrap rounded-md border bg-card px-3 py-2.5 text-muted-foreground text-sm">
						{event.reason}
					</p>
				) : null}
				{open ? (
					<div className="mt-2" id={panelId}>
						<EventComparison event={event} scope={scope} />
					</div>
				) : null}
			</div>
		</li>
	)
}

/** Submissions, decisions and feedback, newest first. */
export function SubmissionHistory(scope: Scope) {
	const history = usePaginatedQuery(
		api.functions.moderation.history.list,
		scope,
		{ initialNumItems: 10 },
	)
	if (history.status === 'LoadingFirstPage') {
		return <Skeleton className="h-32 w-full rounded-lg" />
	}
	if (!history.results.length) {
		return (
			<p className="text-muted-foreground text-sm">
				No moderation history recorded yet.
			</p>
		)
	}
	return (
		<div className="flex flex-col gap-2">
			<ol>
				{history.results.map((event) => (
					<HistoryEvent event={event} key={event._id} scope={scope} />
				))}
			</ol>
			{history.status === 'CanLoadMore' ||
			history.status === 'LoadingMore' ? (
				<Button
					className="self-start"
					disabled={history.status === 'LoadingMore'}
					onClick={() => history.loadMore(10)}
					variant="outline"
				>
					{history.status === 'LoadingMore'
						? 'Loading history...'
						: 'Load older history'}
				</Button>
			) : null}
		</div>
	)
}
