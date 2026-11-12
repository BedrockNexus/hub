'use client'

import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { ReactNode } from 'react'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { pluginReleaseRow } from '@/components/admin-dashboard/admin-plugin-release-review'
import { ReviewVersionsTable } from '@/components/admin-dashboard/review-versions-table'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { useAdminReviewNavigation } from '@/hooks/use-admin-review-navigation'
import type { ReviewTab } from '@/lib/admin-review-navigation'
import { formatDate } from '@/lib/format'
import {
	pluginLifecycleStatus,
	pluginModerationStatus,
} from '@/lib/plugins/moderation-state'
import {
	SubmissionChanges,
	SubmissionHistory,
	useCurrentComparison,
} from './admin-submission-history'
import {
	ListingDecision,
	PluginReleaseDecision,
} from './review/listing-decision'
import { ListingPreview } from './review/listing-preview'
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

type PluginReview = NonNullable<
	FunctionReturnType<typeof api.functions.plugins.projects.getAdminReview>
>

const dateTime = (value?: number) =>
	value
		? formatDate(value, {
				month: 'short',
				hour: 'numeric',
				minute: '2-digit',
			})
		: undefined

export function AdminPluginReview({ pluginId }: { pluginId: string }) {
	const detail = useQuery(api.functions.plugins.projects.getAdminReview, {
		id: pluginId,
	})
	if (detail === undefined) {
		return <Skeleton className="h-[70svh] w-full rounded-md" />
	}
	if (!detail) {
		return (
			<div className="py-16 text-center">
				<h1 className="font-semibold text-xl">Plugin not found</h1>
			</div>
		)
	}
	return <PluginReviewPage detail={detail} />
}

/** Facts about a plugin's builds that decide what can be approved. */
function pluginReadiness({ project, repository, releases }: PluginReview) {
	const branch = encodeURIComponent(repository?.defaultBranch ?? 'main')
	const relativeUrlBase = repository
		? {
				images: `https://raw.githubusercontent.com/${repository.fullName}/${branch}/`,
				links: `${repository.htmlUrl}/blob/${branch}/`,
			}
		: undefined
	const publicationBlocked =
		project.visibility === 'hidden' ||
		project.visibility === 'suspended' ||
		project.status === 'draft'
	const inReview = releases.find((release) => release.status === 'inReview')
	const canApprove = releases.some(
		(release) =>
			(release.status === 'published' &&
				release.versionId === project.latestVersionId &&
				Boolean(release.cdnKey)) ||
			(['inReview', 'publishing'].includes(release.status) &&
				Boolean(release.uploadKey)),
	)

	return { relativeUrlBase, publicationBlocked, inReview, canApprove }
}

function PluginReviewPanel({
	tab,
	detail,
	comparison,
	relativeUrlBase,
	publicationBlocked,
	inReview,
}: {
	tab: ReviewTab
	detail: PluginReview
	comparison: ReturnType<typeof useCurrentComparison>
	inReview: ReturnType<typeof pluginReadiness>['inReview']
} & Pick<
	ReturnType<typeof pluginReadiness>,
	'relativeUrlBase' | 'publicationBlocked'
>) {
	const nav = useAdminReviewNavigation()
	const { project, draft, repository, software, releases, gallery } = detail
	const submission = draft ?? project
	const scope = { contentId: project._id, contentType: 'plugin' as const }
	let panel: ReactNode
	if (tab === 'changes') {
		panel = <SubmissionChanges comparison={comparison} />
	} else if (tab === 'files') {
		panel = (
			<ReviewVersionsTable
				emptyMessage="The creator has not submitted a version for review yet."
				openId={nav.releaseId ?? inReview?._id}
				rows={releases.map((release) =>
					pluginReleaseRow(release, {
						publicationBlocked,
						relativeUrlBase,
						repositoryUrl: repository?.htmlUrl,
						submissionRevision: project.submissionRevision,
					}),
				)}
			/>
		)
	} else if (tab === 'history') {
		panel = <SubmissionHistory {...scope} />
	} else {
		panel = (
			<ListingPreview
				awaitingReview={
					project.submissionStatus === 'pending' || Boolean(inReview)
				}
				description={submission.description}
				details={[
					['Server software', software?.name],
					[
						'Repository',
						repository ? (
							<a
								className="break-all hover:underline"
								href={repository.htmlUrl}
								key="repository"
								rel="noreferrer"
								target="_blank"
							>
								{repository.fullName}
							</a>
						) : undefined,
					],
					[
						'Categories',
						detail.categories
							.map((category) => category.name)
							.join(', '),
					],
					['License', submission.license],
					['License notes', submission.licenseCustom],
				]}
				gallery={gallery}
				links={[
					['Website', submission.websiteUrl],
					['Wiki', submission.wikiUrl],
					['Discord', submission.discordUrl],
					['Issue tracker', submission.issuesUrl],
					['Donations', submission.donationUrl],
				]}
				relativeUrlBase={relativeUrlBase}
				summary={submission.summary}
			/>
		)
	}

	return panel
}

function PluginReviewPage({ detail }: { detail: PluginReview }) {
	const nav = useAdminReviewNavigation()
	const { project, draft, repository, software, releases } = detail
	const submission = draft ?? project
	const pending = project.submissionStatus === 'pending'
	const isUpdate = Boolean(project.publishedAt)
	const revision = project.submissionRevision ?? 0
	const scope = { contentId: project._id, contentType: 'plugin' as const }
	const comparison = useCurrentComparison(scope, project.submissionRevision)
	const review = useReviewAssignment({
		contentId: project._id,
		revision,
		pending,
	})
	const { relativeUrlBase, publicationBlocked, inReview, canApprove } =
		pluginReadiness(detail)

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
		{ id: 'files', label: 'Versions', count: releases.length },
		{ id: 'history', label: 'History' },
	]
	// A build waiting for review is what the moderator came for.
	let fallback: ReviewTab = 'listing'
	if (showChanges) {
		fallback = 'changes'
	} else if (inReview && isUpdate) {
		fallback = 'files'
	}
	const tab =
		nav.tab && tabs.some((item) => item.id === nav.tab) ? nav.tab : fallback

	return (
		<ReviewLayout
			activeTab={tab}
			back={
				pending || inReview
					? { href: '/moderation', label: 'Review queue' }
					: { href: '/moderation/plugins', label: 'Plugins' }
			}
			iconUrl={submission.iconUrl ?? project.iconUrl}
			meta={
				<>
					<span>
						Plugin
						{software?.name ? ` for ${software.name}` : ''}
						{repository ? (
							<>
								{' · '}
								<a
									className="text-foreground hover:underline"
									href={repository.htmlUrl}
									rel="noreferrer"
									target="_blank"
								>
									{repository.fullName}
								</a>
							</>
						) : null}
					</span>
					{pending ? (
						<>
							<ReviewChip>
								{isUpdate
									? `Listing update · revision ${revision}`
									: 'New listing'}
							</ReviewChip>
							<WaitingChip since={project.submittedAt} />
						</>
					) : (
						<>
							<LifecycleStatusBadge
								status={pluginLifecycleStatus(project)}
							/>
							<ModerationStatusBadge
								status={pluginModerationStatus(project)}
							/>
						</>
					)}
					{inReview ? (
						<ReviewChip>
							Version {inReview.version} to review
						</ReviewChip>
					) : null}
				</>
			}
			name={submission.name}
			onTabChange={nav.selectTab}
			rail={
				<>
					<ClaimCard review={review} />
					<ListingDecision
						approveDisabledReason="A reviewed version file is required before publishing."
						canApprove={canApprove}
						contentId={project._id}
						contentType="plugin"
						locked={review.locked}
						moderationStatus={pluginModerationStatus(project)}
						status={pluginLifecycleStatus(project)}
						submissionRevision={project.submissionRevision}
						submissionStatus={project.submissionStatus}
						wasPublished={isUpdate}
					/>
					{inReview ? (
						<PluginReleaseDecision
							locked={review.locked}
							publicationBlocked={publicationBlocked}
							releaseId={inReview._id}
							submissionRevision={project.submissionRevision}
							version={inReview.version}
						/>
					) : null}
					<FeedbackCard
						text={
							project.submissionReason ?? project.moderationReason
						}
					/>
					<FactsCard
						rows={[
							['Server software', software?.name],
							['Submitted', dateTime(project.submittedAt)],
							['Live since', dateTime(project.publishedAt)],
						]}
					/>
				</>
			}
			tabs={tabs}
		>
			<PluginReviewPanel
				comparison={comparison}
				detail={detail}
				inReview={inReview}
				publicationBlocked={publicationBlocked}
				relativeUrlBase={relativeUrlBase}
				tab={tab}
			/>
		</ReviewLayout>
	)
}
