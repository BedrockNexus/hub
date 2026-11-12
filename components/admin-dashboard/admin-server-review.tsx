'use client'

import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { ReactNode } from 'react'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useAdminReviewNavigation } from '@/hooks/use-admin-review-navigation'
import type { ReviewTab } from '@/lib/admin-review-navigation'
import { formatDate } from '@/lib/format'
import {
	SubmissionChanges,
	SubmissionHistory,
	useCurrentComparison,
} from './admin-submission-history'
import { ListingDecision } from './review/listing-decision'
import { ListingPreview } from './review/listing-preview'
import { ownerLabel } from './review/owner'
import {
	ReviewChip,
	ReviewLayout,
	type ReviewTabItem,
	WaitingChip,
} from './review/review-layout'
import {
	ClaimCard,
	FactsCard,
	FeedbackCard,
	useReviewAssignment,
} from './review/review-rail'

type ServerReview = NonNullable<
	FunctionReturnType<typeof api.functions.servers.servers.getAdminReview>
>

const dateTime = (value?: number) =>
	value
		? formatDate(value, {
				month: 'short',
				hour: 'numeric',
				minute: '2-digit',
			})
		: undefined

function verification(server: ServerReview) {
	if (!server.verifiedAt) {
		return <span className="text-destructive">Not verified</span>
	}
	const method = server.verificationMethod?.replace('_', ' ')
	return `Verified${method ? ` by ${method}` : ''} on ${formatDate(server.verifiedAt, { month: 'short' })}`
}

export function AdminServerReview({ serverId }: { serverId: string }) {
	const server = useQuery(api.functions.servers.servers.getAdminReview, {
		id: serverId as Id<'servers'>,
	})
	if (server === undefined) {
		return <Skeleton className="h-[70svh] w-full rounded-md" />
	}
	if (!server) {
		return (
			<div className="py-16 text-center">
				<h1 className="font-semibold text-xl">Server not found</h1>
			</div>
		)
	}
	return <ServerReviewPage server={server} />
}

function ServerReviewPage({ server }: { server: ServerReview }) {
	const nav = useAdminReviewNavigation()
	const pending = server.submissionStatus === 'pending'
	const isUpdate = Boolean(server.publishedAt)
	const revision = server.submissionRevision ?? 0
	const scope = { contentId: server._id, contentType: 'server' as const }
	const comparison = useCurrentComparison(scope, server.submissionRevision)
	const review = useReviewAssignment({
		contentId: server._id,
		revision,
		pending,
	})
	const showChanges = Boolean(comparison && !comparison.firstSubmission)
	const tabs: ReviewTabItem[] = [
		...(showChanges
			? [
					{
						id: 'changes' as const,
						label: 'Changes',
						count: comparison?.fields.length,
					},
				]
			: []),
		{ id: 'listing', label: 'Listing preview' },
		{ id: 'history', label: 'History' },
	]
	const fallback: ReviewTab = showChanges ? 'changes' : 'listing'
	const tab =
		nav.tab && tabs.some((item) => item.id === nav.tab) ? nav.tab : fallback

	let panel: ReactNode
	if (tab === 'changes') {
		panel = <SubmissionChanges comparison={comparison} />
	} else if (tab === 'history') {
		panel = <SubmissionHistory {...scope} />
	} else {
		panel = (
			<ListingPreview
				awaitingReview={pending}
				bannerUrl={server.bannerUrl}
				description={server.description || server.smallDescription}
				details={[
					[
						'Address',
						<span className="font-mono text-[13px]" key="address">
							{server.ipAddress}:{server.port}
						</span>,
					],
					['Ownership', verification(server)],
					['Software', server.software?.name],
					['Region', server.region],
					['Game versions', server.gameVersions?.join(', ')],
					[
						'Categories',
						server.categories
							.map((category) => category?.name)
							.filter(Boolean)
							.join(', '),
					],
					['Languages', server.language?.join(', ')],
					['Tags', server.tags?.join(', ')],
				]}
				gallery={server.gallery}
				links={[
					['Website', server.website],
					['Discord', server.discordUrl],
					['Store', server.storeUrl],
					['Wiki', server.wikiUrl],
				]}
				summary={
					server.description ? server.smallDescription : undefined
				}
			/>
		)
	}

	return (
		<ReviewLayout
			activeTab={tab}
			back={
				pending
					? { href: '/moderation', label: 'Review queue' }
					: { href: '/moderation/servers', label: 'Servers' }
			}
			iconUrl={server.logoUrl}
			meta={
				<>
					<span>
						Server · by{' '}
						<span className="text-foreground">
							{ownerLabel(server.owner)}
						</span>
					</span>
					{pending ? (
						<>
							<ReviewChip>
								{isUpdate
									? `Listing update · revision ${revision}`
									: 'New listing'}
							</ReviewChip>
							<WaitingChip since={server.submittedAt} />
							{isUpdate ? (
								<span>Stays live while you review</span>
							) : null}
						</>
					) : (
						<>
							<LifecycleStatusBadge status={server.status} />
							<ModerationStatusBadge
								status={server.moderationStatus}
							/>
						</>
					)}
				</>
			}
			name={server.name}
			onTabChange={nav.selectTab}
			rail={
				<>
					<ClaimCard review={review} />
					<ListingDecision
						canApprove
						contentId={server._id}
						contentType="server"
						locked={review.locked}
						moderationStatus={server.moderationStatus}
						status={server.status}
						submissionRevision={server.submissionRevision}
						submissionStatus={server.submissionStatus}
						wasPublished={isUpdate}
					/>
					<FeedbackCard
						text={
							server.submissionReason ?? server.moderationReason
						}
					/>
					<FactsCard
						rows={[
							['Creator', ownerLabel(server.owner)],
							[
								'Address',
								<span
									className="font-mono text-[13px] [overflow-wrap:anywhere]"
									key="address"
								>
									{server.ipAddress}:{server.port}
								</span>,
							],
							['Ownership', verification(server)],
							['Submitted', dateTime(server.submittedAt)],
						]}
					/>
				</>
			}
			tabs={tabs}
		>
			{panel}
		</ReviewLayout>
	)
}
