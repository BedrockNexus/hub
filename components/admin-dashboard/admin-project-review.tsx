'use client'

import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { AdminModerationActions } from '@/components/admin-dashboard/admin-moderation-actions'
import {
	ReleaseReviewActions,
	ReleaseReviewBadge,
} from '@/components/admin-dashboard/admin-release-review'
import {
	type ReviewVersionRow,
	ReviewVersionsTable,
} from '@/components/admin-dashboard/review-versions-table'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { ProjectTypeDetailsCard } from '@/components/projects/detail/project-type-details-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useAdminReviewNavigation } from '@/hooks/use-admin-review-navigation'
import { moderationCollectionHref } from '@/lib/admin-review-navigation'
import {
	normalizeProjectType,
	PROJECT_TYPE_PLURAL_LABELS,
} from '@/lib/project-artifacts'
import { AdminReviewShell, ReviewSectionPanel } from './admin-review-shell'
import { AdminSubmissionHistory } from './admin-submission-history'
import { SubmissionMetadata } from './submission-metadata'

type ProjectReview = NonNullable<
	FunctionReturnType<typeof api.functions.projects.projects.getAdminReview>
>
type ProjectVersion = ProjectReview['versions'][number]

function canReviewVersion(project: ProjectReview, version: ProjectVersion) {
	return (
		version.reviewStatus === 'pending' &&
		project.submissionStatus !== 'pending' &&
		project.status === 'published' &&
		project.moderationStatus === 'approved' &&
		!version.deletionRequestedAt
	)
}

function projectVersionNotices(version: ProjectVersion) {
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

function projectVersionRow(
	project: ProjectReview,
	version: ProjectVersion,
	selected: boolean,
	onReviewVersion: (id: string) => unknown,
): ReviewVersionRow {
	let actions: ReactNode
	if (canReviewVersion(project, version)) {
		actions = selected ? (
			<p className="text-muted-foreground text-sm">
				Use the decision bar below to approve or reject this version.
			</p>
		) : (
			<Button
				onClick={() => onReviewVersion(version._id)}
				size="sm"
				variant="outline"
			>
				Review version
			</Button>
		)
	}
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
			['Validation', version.validationStatus ?? 'valid'],
		],
		notices: projectVersionNotices(version),
		changelog: (
			<RichTextViewer
				content={version.changelog || 'No changelog supplied.'}
			/>
		),
		actions,
	}
}

function ProjectReviewVersions({
	project,
	onReviewVersion,
	selectedId,
}: {
	project: ProjectReview
	selectedId?: string | null
	onReviewVersion: (id: string) => unknown
}) {
	return (
		<ReviewVersionsTable
			emptyMessage="No version files uploaded"
			openId={selectedId}
			rows={project.versions.map((version) =>
				projectVersionRow(
					project,
					version,
					version._id === selectedId,
					onReviewVersion,
				),
			)}
		/>
	)
}
function ProjectVersionDecision({
	version,
}: {
	version: ProjectReview['versions'][number]
}) {
	if (version.deletionRequestedAt) {
		return (
			<p className="text-muted-foreground text-sm">
				File removal requested.
			</p>
		)
	}
	if (version.reviewStatus === 'pending') {
		return (
			<ReleaseReviewActions
				canApprove={version.validationStatus === 'valid'}
				versionId={version._id}
				versionLabel={`v${version.version}`}
			/>
		)
	}
	return <ReleaseReviewBadge status={version.reviewStatus} />
}
function ProjectReviewHeader({ project }: { project: ProjectReview }) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="space-y-3">
				<Button
					nativeButton={false}
					render={
						<Link
							href={moderationCollectionHref(
								'projects',
								normalizeProjectType(project.type),
							)}
						/>
					}
					variant="ghost"
				>
					<HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
					{
						PROJECT_TYPE_PLURAL_LABELS[
							normalizeProjectType(project.type)
						]
					}
				</Button>
				<div className="flex items-center gap-4">
					{project.iconUrl ? (
						<Image
							alt={`${project.name} icon`}
							className="size-16 rounded-md border object-cover"
							height={64}
							src={project.iconUrl}
							width={64}
						/>
					) : null}
					<div>
						<h1 className="font-semibold text-2xl">
							{project.name}
						</h1>
						<p className="text-muted-foreground text-sm">
							{project.summary}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<LifecycleStatusBadge status={project.status} />
					<ModerationStatusBadge status={project.moderationStatus} />
					<Badge variant="outline">
						{project.type.replace('_', ' ')}
					</Badge>
				</div>
			</div>
		</div>
	)
}
function standaloneVersion(
	project: ProjectReview,
	selected?: ProjectReview['versions'][number],
) {
	return selected &&
		project.submissionStatus !== 'pending' &&
		project.status === 'published' &&
		project.moderationStatus === 'approved'
		? selected
		: undefined
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
			<Card>
				<CardContent className="py-16 text-center">
					<h1 className="font-semibold text-xl">Project not found</h1>
				</CardContent>
			</Card>
		)
	}

	const hasVersionFiles = project.versions.some(
		(version) =>
			(version.validationStatus === 'valid' ||
				version.validationStatus === undefined) &&
			version.reviewStatus !== 'rejected',
	)
	const versionApprovalMessage =
		'The creator must have a validated release eligible for review before this listing can be approved.'

	const selectedVersion = nav.releaseId
		? project.versions.find((version) => version._id === nav.releaseId)
		: undefined
	const versionReview = standaloneVersion(project, selectedVersion)

	return (
		<AdminReviewShell
			actions={
				versionReview ? (
					<ProjectVersionDecision version={versionReview} />
				) : (
					<AdminModerationActions
						approveDisabledReason={
							hasVersionFiles ? undefined : versionApprovalMessage
						}
						canApprove={hasVersionFiles}
						contentId={project._id}
						contentName={project.name}
						contentType="project"
						moderationStatus={project.moderationStatus}
						status={project.status}
						submissionRevision={project.submissionRevision}
						submissionStatus={project.submissionStatus}
						wasPublished={Boolean(project.publishedAt)}
					/>
				)
			}
			header={<ProjectReviewHeader project={project} />}
			identity={
				versionReview
					? {
							contentId: versionReview._id,
							revision: versionReview.createdAt,
							pending:
								versionReview.reviewStatus === 'pending' &&
								!versionReview.deletionRequestedAt,
						}
					: {
							contentId: project._id,
							revision: project.submissionRevision ?? 0,
							pending: project.submissionStatus === 'pending',
						}
			}
			note={
				versionReview
					? versionReview.reviewReason
					: (project.submissionReason ?? project.moderationReason)
			}
			submissionRevision={project.submissionRevision}
			submissionStatus={project.submissionStatus}
			submittedAt={versionReview?.createdAt ?? project.submittedAt}
			versionLabel={
				versionReview ? `version ${versionReview.version}` : undefined
			}
		>
			<ReviewSectionPanel active={nav.section === 'overview'}>
				<div className="space-y-6">
					{project.bannerUrl ? (
						<Image
							alt={`${project.name} banner`}
							className="max-h-64 w-full rounded-md border object-cover"
							height={400}
							src={project.bannerUrl}
							width={1200}
						/>
					) : null}
					<Card className="h-fit">
						<CardHeader>
							<CardTitle className="text-base">
								Submission details
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-6 text-sm sm:grid-cols-2 xl:grid-cols-3">
							<div>
								<p className="text-muted-foreground">Owner</p>
								<p>
									{project.owner?.type === 'organization'
										? project.owner.name
										: project.owner?.displayUsername ||
											project.owner?.username ||
											'Unknown user'}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">License</p>
								<p>{project.license || 'Not provided'}</p>
							</div>
							<div>
								<p className="text-muted-foreground">
									Categories
								</p>
								<p>
									{project.categories
										.map((category) => category?.name)
										.filter(Boolean)
										.join(', ') || 'None'}
								</p>
							</div>
						</CardContent>
					</Card>
					<ProjectTypeDetailsCard metadata={project.metadata} />
				</div>
			</ReviewSectionPanel>
			<ReviewSectionPanel active={nav.section === 'changes'}>
				<AdminSubmissionHistory
					contentId={project._id}
					contentType="project"
					mode="changes"
					revision={project.submissionRevision}
				/>
			</ReviewSectionPanel>
			<ReviewSectionPanel active={nav.section === 'description'}>
				<Card>
					<CardHeader>
						<CardTitle>Description</CardTitle>
					</CardHeader>
					<CardContent>
						<RichTextViewer content={project.description} />
					</CardContent>
				</Card>
			</ReviewSectionPanel>
			<ReviewSectionPanel active={nav.section === 'gallery'}>
				<Card>
					<CardHeader>
						<CardTitle>Gallery</CardTitle>
					</CardHeader>
					<CardContent>
						<GalleryGrid
							emptyDescription="No screenshots were supplied."
							emptyTitle="No gallery images"
							items={project.gallery}
						/>
					</CardContent>
				</Card>
			</ReviewSectionPanel>
			<div className="space-y-6" hidden={nav.section !== 'versions'}>
				<ProjectReviewVersions
					onReviewVersion={nav.selectRelease}
					project={project}
					selectedId={nav.releaseId}
				/>
			</div>
			<ReviewSectionPanel active={nav.section === 'links'}>
				<SubmissionMetadata
					fields={[
						['Tags', project.tags?.join(', ')],
						['License notes', project.licenseCustom],
					]}
					links={[
						['Source', project.sourceUrl],
						['Website', project.websiteUrl],
						['Issue tracker', project.issueTrackerUrl],
						['Wiki', project.wikiUrl],
						['Discord', project.discordUrl],
						['Donations', project.donationUrl],
					]}
				/>
			</ReviewSectionPanel>
			<ReviewSectionPanel active={nav.section === 'history'}>
				<AdminSubmissionHistory
					contentId={project._id}
					contentType="project"
					mode="history"
					revision={project.submissionRevision}
				/>
			</ReviewSectionPanel>
		</AdminReviewShell>
	)
}
