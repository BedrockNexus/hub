'use client'

import { Download01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { ReleaseReviewBadge } from '@/components/admin-dashboard/admin-release-review'
import {
	type ReviewVersionRow,
	ReviewVersionsTable,
} from '@/components/admin-dashboard/review-versions-table'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { ProjectTypeDetailsCard } from '@/components/projects/detail/project-type-details-card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useAdminReviewNavigation } from '@/hooks/use-admin-review-navigation'
import {
	moderationCollectionHref,
	type ReviewTab,
} from '@/lib/admin-review-navigation'
import { contentHref } from '@/lib/content-routes'
import { formatDate } from '@/lib/format'
import { formatBytes } from '@/lib/plugins/format-registry'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
	PROJECT_TYPE_PLURAL_LABELS,
} from '@/lib/project-artifacts'
import { userFacingError } from '@/lib/user-facing-error'
import {
	SubmissionChanges,
	SubmissionHistory,
	useCurrentComparison,
} from './admin-submission-history'
import { ListingDecision, ReleaseDecision } from './review/listing-decision'
import { ListingPreview } from './review/listing-preview'
import { ownerLabel } from './review/owner'
import { AutomaticChecks, FileChanges } from './review/release-checks'
import {
	ReviewChip,
	ReviewLayout,
	ReviewSection,
	type ReviewTabItem,
	WaitingChip,
} from './review/review-layout'
import {
	ClaimCard,
	FactsCard,
	FeedbackCard,
	NextReviewButton,
	RailCard,
	useReviewAssignment,
} from './review/review-rail'

type ProjectReview = NonNullable<
	FunctionReturnType<typeof api.functions.projects.projects.getAdminReview>
>
type ProjectVersion = ProjectReview['versions'][number]

const dateTime = (value?: number) =>
	value
		? formatDate(value, {
				month: 'short',
				hour: 'numeric',
				minute: '2-digit',
			})
		: undefined

function canReviewVersion(project: ProjectReview, version: ProjectVersion) {
	return (
		version.reviewStatus === 'pending' &&
		project.submissionStatus !== 'pending' &&
		project.status === 'published' &&
		project.moderationStatus === 'approved' &&
		!version.deletionRequestedAt
	)
}

/** A version reviewed on its own: the listing is already public and approved. */
function standaloneVersion(project: ProjectReview, selected?: ProjectVersion) {
	return selected &&
		project.submissionStatus !== 'pending' &&
		project.status === 'published' &&
		project.moderationStatus === 'approved'
		? selected
		: undefined
}

function versionNotices(version: ProjectVersion) {
	if (
		!(
			version.validationError ||
			version.reviewReason ||
			version.deletionRequestedAt
		)
	) {
		return null
	}
	return (
		<div className="space-y-2 text-sm">
			{version.deletionRequestedAt ? (
				<p className="text-muted-foreground">File removal requested.</p>
			) : null}
			{version.validationError ? (
				<p className="text-destructive">{version.validationError}</p>
			) : null}
			{version.reviewReason ? (
				<p className="whitespace-pre-wrap">
					Moderator feedback: {version.reviewReason}
				</p>
			) : null}
		</div>
	)
}

function versionRow(
	project: ProjectReview,
	version: ProjectVersion,
	onReview: (id: string) => unknown,
): ReviewVersionRow {
	return {
		id: version._id,
		version: version.version,
		fileName: version.fileName,
		size: version.fileSize,
		submittedAt: version.createdAt,
		status: <ReleaseReviewBadge status={version.reviewStatus} />,
		facts: [
			[
				'Game versions',
				version.gameVersions?.join(', ') || 'Not specified',
			],
			['Checks', version.validationStatus ?? 'valid'],
		],
		notices: versionNotices(version),
		changelog: (
			<RichTextViewer
				content={version.changelog || 'No changelog supplied.'}
			/>
		),
		actions: canReviewVersion(project, version) ? (
			<Button onClick={() => onReview(version._id)} variant="outline">
				Review this version
			</Button>
		) : undefined,
	}
}

function backLink(project: ProjectReview, pending: boolean) {
	const type = normalizeProjectType(project.type)
	return pending
		? { href: '/moderation', label: 'Review queue' }
		: {
				href: moderationCollectionHref('projects', type),
				label: PROJECT_TYPE_PLURAL_LABELS[type],
			}
}

function PublicPageLink({ project }: { project: ProjectReview }) {
	if (!(project.publishedAt && project.status === 'published')) {
		return null
	}
	return (
		<Link
			className={buttonVariants({ variant: 'outline' })}
			href={
				contentHref(
					project.type,
					project.slug,
					project._id,
					project.publicId,
				) as Route
			}
			target="_blank"
		>
			Open public page
			<HugeiconsIcon aria-hidden icon={LinkSquare02Icon} />
		</Link>
	)
}

function ProjectListingReview({ project }: { project: ProjectReview }) {
	const nav = useAdminReviewNavigation()
	const pending = project.submissionStatus === 'pending'
	const isUpdate = Boolean(project.publishedAt)
	const revision = project.submissionRevision ?? 0
	const scope = { contentId: project._id, contentType: 'project' as const }
	const comparison = useCurrentComparison(scope, project.submissionRevision)
	const review = useReviewAssignment({
		contentId: project._id,
		revision,
		pending,
	})
	const type = normalizeProjectType(project.type)
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
		{ id: 'files', label: 'Versions', count: project.versions.length },
		{ id: 'history', label: 'History' },
	]
	const fallback: ReviewTab = showChanges ? 'changes' : 'listing'
	const tab =
		nav.tab && tabs.some((item) => item.id === nav.tab) ? nav.tab : fallback
	const hasVersionFiles = project.versions.some(
		(version) =>
			(version.validationStatus === 'valid' ||
				version.validationStatus === undefined) &&
			version.reviewStatus !== 'rejected',
	)

	let panel: ReactNode
	if (tab === 'changes') {
		panel = <SubmissionChanges comparison={comparison} />
	} else if (tab === 'files') {
		panel = (
			<ReviewVersionsTable
				emptyMessage="No version files uploaded"
				openId={
					project.versions.find((v) => canReviewVersion(project, v))
						?._id
				}
				rows={project.versions.map((version) =>
					versionRow(project, version, nav.selectRelease),
				)}
			/>
		)
	} else if (tab === 'history') {
		panel = <SubmissionHistory {...scope} />
	} else {
		panel = (
			<ListingPreview
				awaitingReview={pending}
				bannerUrl={project.bannerUrl}
				description={project.description}
				details={[
					['Owner', ownerLabel(project.owner)],
					[
						'Categories',
						project.categories
							.map((category) => category?.name)
							.filter(Boolean)
							.join(', '),
					],
					['License', project.license],
					['License notes', project.licenseCustom],
					['Tags', project.tags?.join(', ')],
				]}
				extra={<ProjectTypeDetailsCard metadata={project.metadata} />}
				gallery={project.gallery}
				links={[
					['Source', project.sourceUrl],
					['Website', project.websiteUrl],
					['Issue tracker', project.issueTrackerUrl],
					['Wiki', project.wikiUrl],
					['Discord', project.discordUrl],
					['Donations', project.donationUrl],
				]}
				summary={project.summary}
			/>
		)
	}

	return (
		<ReviewLayout
			actions={<PublicPageLink project={project} />}
			activeTab={tab}
			back={backLink(project, pending)}
			iconUrl={project.iconUrl}
			meta={
				<>
					<span>
						{PROJECT_TYPE_LABELS[type]} · by{' '}
						<span className="text-foreground">
							{ownerLabel(project.owner)}
						</span>
					</span>
					{pending ? (
						<>
							<ReviewChip>
								{isUpdate
									? `Listing update · revision ${revision}`
									: 'New listing'}
							</ReviewChip>
							<WaitingChip since={project.submittedAt} />
							{isUpdate ? (
								<span>Stays live while you review</span>
							) : null}
						</>
					) : (
						<>
							<LifecycleStatusBadge status={project.status} />
							<ModerationStatusBadge
								status={project.moderationStatus}
							/>
						</>
					)}
				</>
			}
			name={project.name}
			onTabChange={nav.selectTab}
			rail={
				<>
					<ClaimCard review={review} />
					<ListingDecision
						approveDisabledReason="The creator must have a validated version eligible for review before this listing can be approved."
						canApprove={hasVersionFiles}
						contentId={project._id}
						contentType="project"
						locked={review.locked}
						moderationStatus={project.moderationStatus}
						status={project.status}
						submissionRevision={project.submissionRevision}
						submissionStatus={project.submissionStatus}
						wasPublished={isUpdate}
					/>
					<FeedbackCard
						text={
							project.submissionReason ?? project.moderationReason
						}
					/>
					<FactsCard
						rows={[
							['Creator', ownerLabel(project.owner)],
							['Submitted', dateTime(project.submittedAt)],
							['Live since', dateTime(project.publishedAt)],
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

function DownloadButton({ versionId }: { versionId: Id<'projectVersions'> }) {
	const getUrl = useAction(
		api.functions.projects.releaseReview.getReleaseDownloadUrl,
	)
	const [busy, setBusy] = useState(false)
	return (
		<Button
			disabled={busy}
			onClick={async () => {
				setBusy(true)
				try {
					window.location.assign(await getUrl({ versionId }))
				} catch (error) {
					toast.error(
						userFacingError(error, 'Could not download the file'),
					)
				} finally {
					setBusy(false)
				}
			}}
			variant="outline"
		>
			Download file
			<HugeiconsIcon aria-hidden icon={Download01Icon} />
		</Button>
	)
}

function ProjectReleaseReview({
	project,
	version,
}: {
	project: ProjectReview
	version: ProjectVersion
}) {
	const nav = useAdminReviewNavigation()
	const pending =
		version.reviewStatus === 'pending' && !version.deletionRequestedAt
	const review = useReviewAssignment({
		contentId: version._id,
		revision: version.createdAt,
		pending,
	})
	const type = normalizeProjectType(project.type)
	const others = project.versions.filter((item) => item._id !== version._id)
	const approved = others.filter(
		(item) => (item.reviewStatus ?? 'approved') === 'approved',
	).length
	const rejected = others.filter(
		(item) => item.reviewStatus === 'rejected',
	).length
	let decision: ReactNode
	if (pending) {
		decision = (
			<ReleaseDecision
				canApprove={version.validationStatus === 'valid'}
				locked={review.locked}
				version={version.version}
				versionId={version._id}
			/>
		)
	} else if (version.deletionRequestedAt) {
		decision = (
			<RailCard className="px-4 py-3.5 text-muted-foreground text-sm">
				The creator asked to remove this file.
			</RailCard>
		)
	} else {
		decision = (
			<RailCard className="flex flex-col gap-3 px-4 py-3.5 text-sm">
				<span className="flex items-center justify-between gap-3">
					This version is
					<ReleaseReviewBadge status={version.reviewStatus} />
				</span>
				<NextReviewButton currentId={version._id} />
			</RailCard>
		)
	}
	return (
		<ReviewLayout
			actions={
				<>
					<DownloadButton versionId={version._id} />
					<Button onClick={nav.selectListing} variant="outline">
						Review listing
					</Button>
				</>
			}
			back={
				pending
					? { href: '/moderation', label: 'Review queue' }
					: backLink(project, false)
			}
			iconUrl={project.iconUrl}
			meta={
				<>
					<span>
						{PROJECT_TYPE_LABELS[type]} · by{' '}
						<span className="text-foreground">
							{ownerLabel(project.owner)}
						</span>
					</span>
					{pending ? (
						<>
							<ReviewChip>New version</ReviewChip>
							<WaitingChip since={version.createdAt} />
							<span>
								Hidden until approved
								{project.latestVersionString &&
								project.latestVersionString !== version.version
									? ` · ${project.latestVersionString} is the current version`
									: ''}
							</span>
						</>
					) : (
						<ReleaseReviewBadge status={version.reviewStatus} />
					)}
				</>
			}
			name={project.name}
			rail={
				<>
					<ClaimCard review={review} />
					{decision}
					<FeedbackCard
						text={version.reviewReason}
						title="Feedback"
					/>
					<FactsCard
						rows={[
							[
								'File',
								<span
									className="font-mono text-[13px] [overflow-wrap:anywhere]"
									key="file"
								>
									{version.fileName}
								</span>,
							],
							['Size', formatBytes(version.fileSize)],
							['Uploaded', dateTime(version.createdAt)],
							[
								'Earlier versions',
								others.length
									? `${approved} approved · ${rejected} rejected`
									: 'None',
							],
						]}
					/>
				</>
			}
			title={
				<>
					{project.name}{' '}
					<span className="text-primary">{version.version}</span>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<AutomaticChecks version={version} />
				<ReviewSection title="Changelog">
					<div className="px-4.5 py-3.5 text-muted-foreground">
						<RichTextViewer
							content={
								version.changelog || 'No changelog supplied.'
							}
						/>
					</div>
				</ReviewSection>
				<FileChanges versionId={version._id} />
			</div>
		</ReviewLayout>
	)
}

export function AdminProjectReview({ projectId }: { projectId: string }) {
	const nav = useAdminReviewNavigation()
	const project = useQuery(api.functions.projects.projects.getAdminReview, {
		id: projectId as Id<'projects'>,
	})

	if (project === undefined) {
		return <Skeleton className="h-[70svh] w-full rounded-md" />
	}
	if (!project) {
		return (
			<div className="py-16 text-center">
				<h1 className="font-semibold text-xl">Project not found</h1>
			</div>
		)
	}
	const selected = nav.releaseId
		? project.versions.find((version) => version._id === nav.releaseId)
		: undefined
	const version = standaloneVersion(project, selected)
	return version ? (
		<ProjectReleaseReview
			key={version._id}
			project={project}
			version={version}
		/>
	) : (
		<ProjectListingReview project={project} />
	)
}
