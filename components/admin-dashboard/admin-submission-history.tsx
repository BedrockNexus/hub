'use client'

import { usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useId, useState } from 'react'
import { SubmissionComparison } from '@/components/admin-dashboard/submission-comparison'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
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
function ComparisonResult({
	comparison,
}: {
	comparison:
		| FunctionReturnType<
				typeof api.functions.moderation.history.getComparison
		  >
		| undefined
}) {
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
function HistoryResults({
	loading,
	events,
	scope,
}: {
	loading: boolean
	events: Event[]
	scope: Scope
}) {
	if (loading) {
		return <Skeleton className="h-24 w-full" />
	}
	if (!events.length) {
		return (
			<p className="text-muted-foreground text-sm">
				No moderation history recorded yet.
			</p>
		)
	}
	return (
		<ol className="divide-y">
			{events.map((event) => (
				<HistoryEvent event={event} key={event._id} scope={scope} />
			))}
		</ol>
	)
}
function HistoryEvent({ event, scope }: { event: Event; scope: Scope }) {
	const [open, setOpen] = useState(false)
	const panelId = useId()
	const comparison = useQuery(
		api.functions.moderation.history.getComparison,
		open && event.hasComparison ? { ...scope, eventId: event._id } : 'skip',
	)
	return (
		<li className="space-y-3 py-4 first:pt-0 last:pb-0">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<h3 className="font-medium text-sm">{event.title}</h3>
					<p className="text-muted-foreground text-xs">
						{event.actor} <span aria-hidden>·</span>{' '}
						<time
							dateTime={new Date(event.createdAt).toISOString()}
						>
							{formatDate(event.createdAt, {
								hour: 'numeric',
								minute: '2-digit',
								second: '2-digit',
							})}
						</time>
					</p>
					{event.label ? (
						<p className="text-muted-foreground text-xs">
							{event.label}
						</p>
					) : null}
				</div>
				{event.hasComparison ? (
					<Button
						aria-controls={panelId}
						aria-expanded={open}
						onClick={() => setOpen((value) => !value)}
						size="sm"
						variant="outline"
					>
						{open ? 'Hide changes' : 'View submitted changes'}
					</Button>
				) : null}
			</div>
			{event.reason ? (
				<p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
					{event.reason}
				</p>
			) : null}
			{open ? (
				<div className="rounded-md border p-4" id={panelId}>
					<ComparisonResult comparison={comparison} />
				</div>
			) : null}
		</li>
	)
}
export function AdminSubmissionHistory({
	contentId,
	contentType,
	revision,
}: Scope & { revision?: number }) {
	const scope = { contentId, contentType }
	const current = useQuery(
		api.functions.moderation.history.getCurrentComparison,
		scope,
	)
	const [historyOpen, setHistoryOpen] = useState(false)
	const history = usePaginatedQuery(
		api.functions.moderation.history.list,
		historyOpen ? scope : 'skip',
		{ initialNumItems: 10 },
	)
	return (
		<div className="space-y-6">
			{current && current.revision === (revision ?? 0) ? (
				<Card>
					<CardHeader>
						<CardTitle>Changes in this submission</CardTitle>
						<CardDescription>
							Compare the submitted details with the last approved
							listing.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<SubmissionComparison comparison={current} />
					</CardContent>
				</Card>
			) : null}
			<Card>
				<details
					onToggle={(event) =>
						setHistoryOpen(event.currentTarget.open)
					}
				>
					<summary className="cursor-pointer rounded-md px-6 py-5 font-semibold text-base outline-none focus-visible:ring-2 focus-visible:ring-ring">
						Moderation history
					</summary>

					<CardContent>
						<p className="mb-4 text-muted-foreground text-sm">
							Submissions, decisions, and moderator feedback.
							Older decisions may not have a saved comparison.
						</p>
						<HistoryResults
							events={history.results}
							loading={history.status === 'LoadingFirstPage'}
							scope={scope}
						/>
						{history.status === 'CanLoadMore' ||
						history.status === 'LoadingMore' ? (
							<Button
								className="mt-4"
								disabled={history.status === 'LoadingMore'}
								onClick={() => history.loadMore(10)}
								variant="outline"
							>
								{history.status === 'LoadingMore'
									? 'Loading history...'
									: 'Load older history'}
							</Button>
						) : null}
					</CardContent>
				</details>
			</Card>
		</div>
	)
}
