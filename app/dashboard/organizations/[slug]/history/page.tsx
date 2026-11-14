'use client'

import { Clock01Icon } from '@hugeicons/core-free-icons'
import { usePaginatedQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { formatDistanceToNowStrict } from 'date-fns'
import { useParams } from 'next/navigation'
import { PagedList } from '@/components/social/paged-list'
import { WorkspacePageHeader } from '@/components/workspace-page-header'
import { api } from '@/convex/_generated/api'
import { useFullOrganization } from '@/hooks/use-organization'

type AuditEvent = FunctionReturnType<
	typeof api.functions.site.organizations.listAuditEvents
>['page'][number]

const PAGE_SIZE = 30

const TARGET_LABELS = {
	project: 'listing',
	server: 'server',
	plugin: 'plugin',
	member: 'member',
} as const

function describe(event: AuditEvent) {
	const target = `${TARGET_LABELS[event.targetType]} ${event.targetLabel}`
	switch (event.action) {
		case 'listing.created':
			return `Created ${target}`
		case 'listing.published':
			return `Published ${target}`
		case 'listing.unpublished':
			return `Unpublished ${target}`
		case 'listing.moderated':
			return `Moderation set ${target} to ${event.detail ?? 'a new status'}`
		case 'listing.deleted':
			return `Deleted ${target}`
		case 'listing.transferred_in':
			return `Moved ${target} into the organization`
		case 'listing.transferred_out':
			return `Moved ${target} out of the organization`
		case 'member.added':
			return `${event.targetLabel} joined${event.detail ? ` as ${event.detail}` : ''}`
		case 'member.removed':
			return `${event.targetLabel} left or was removed`
		case 'member.role_changed':
			return `${event.targetLabel} is now ${event.detail ?? 'a member'}`
		default:
			return target
	}
}

function HistoryList({ organizationId }: { organizationId: string }) {
	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.site.organizations.listAuditEvents,
		{ organizationId },
		{ initialNumItems: PAGE_SIZE },
	)
	return (
		<PagedList
			empty={{
				icon: Clock01Icon,
				title: 'No history yet',
				description:
					'Changes to the organization’s listings and members appear here.',
			}}
			items={results}
			loadMore={loadMore}
			pageSize={PAGE_SIZE}
			renderItem={(event) => (
				<li
					className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border bg-card px-4 py-3 text-sm"
					key={event._id}
				>
					<span className="min-w-0">
						{describe(event)}
						{event.actorName ? (
							<span className="text-muted-foreground">
								{' '}
								by {event.actorName}
							</span>
						) : null}
					</span>
					<time
						className="shrink-0 text-muted-foreground text-xs"
						dateTime={new Date(event.createdAt).toISOString()}
					>
						{formatDistanceToNowStrict(event.createdAt, {
							addSuffix: true,
						})}
					</time>
				</li>
			)}
			status={status}
		/>
	)
}

export default function OrganizationHistoryPage() {
	const params = useParams()
	const { organization } = useFullOrganization(params.slug as string)
	return (
		<div className="space-y-6">
			<WorkspacePageHeader
				description="What happened to this organization’s listings and members. Visible to members."
				title="History"
			/>
			{organization ? (
				<HistoryList organizationId={organization.id} />
			) : null}
		</div>
	)
}
