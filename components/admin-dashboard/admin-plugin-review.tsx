'use client'

import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { AdminModerationActions } from '@/components/admin-dashboard/admin-moderation-actions'
import { pluginReleaseRow } from '@/components/admin-dashboard/admin-plugin-release-review'
import { PluginReviewStatusBadge } from '@/components/admin-dashboard/plugin-review-status'
import { ReviewVersionsTable } from '@/components/admin-dashboard/review-versions-table'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { useAdminReviewNavigation } from '@/hooks/use-admin-review-navigation'
import { formatDate } from '@/lib/format'
import {
	pluginLifecycleStatus,
	pluginModerationStatus,
} from '@/lib/plugins/moderation-state'
import { AdminReviewShell, ReviewSectionPanel } from './admin-review-shell'
import { AdminSubmissionHistory } from './admin-submission-history'
import { SubmissionMetadata } from './submission-metadata'

export function AdminPluginReview({ pluginId }: { pluginId: string }) {
	const nav = useAdminReviewNavigation()
	const detail = useQuery(api.functions.plugins.projects.getAdminReview, {
		id: pluginId,
	})
	if (detail === undefined) {
		return <Skeleton className="h-[70svh] w-full rounded-md" />
	}
	const back = (
		<Button
			nativeButton={false}
			render={<Link href="/moderation/plugins" />}
			variant="ghost"
		>
			<HugeiconsIcon
				aria-hidden
				className="size-4"
				icon={ArrowLeft02Icon}
			/>
			Plugins
		</Button>
	)
	if (!detail) {
		return (
			<div className="space-y-4">
				{back}
				<Card>
					<CardContent className="py-16 text-center">
						<h1 className="font-semibold text-xl">
							Plugin not found
						</h1>
					</CardContent>
				</Card>
			</div>
		)
	}
	const { project, draft, repository, software, releases, gallery } = detail
	const branch = encodeURIComponent(repository?.defaultBranch ?? 'main')
	const relativeUrlBase = repository
		? {
				images: `https://raw.githubusercontent.com/${repository.fullName}/${branch}/`,
				links: `${repository.htmlUrl}/blob/${branch}/`,
			}
		: undefined
	const submission = draft ?? project
	const iconUrl = submission.iconUrl ?? project.iconUrl
	return (
		<AdminReviewShell
			actions={
				<AdminModerationActions
					approveDisabledReason="A reviewed release file is required before publishing."
					canApprove={releases.some(
						(release) =>
							(release.status === 'published' &&
								release.versionId === project.latestVersionId &&
								Boolean(release.cdnKey)) ||
							(['inReview', 'publishing'].includes(
								release.status,
							) &&
								Boolean(release.uploadKey)),
					)}
					contentId={project._id}
					contentName={submission.name}
					contentType="plugin"
					moderationStatus={pluginModerationStatus(project)}
					status={pluginLifecycleStatus(project)}
					submissionRevision={project.submissionRevision}
					submissionStatus={project.submissionStatus}
					wasPublished={Boolean(project.publishedAt)}
				/>
			}
			header={
				<header className="space-y-3">
					{back}
					<p className="text-muted-foreground text-sm">
						Review submission
					</p>
					<div className="flex items-center gap-4">
						{iconUrl ? (
							<Image
								alt={`${submission.name} icon`}
								className="size-16 rounded-md border object-cover"
								height={64}
								src={iconUrl}
								width={64}
							/>
						) : null}
						<div>
							<h1 className="font-semibold text-2xl">
								{submission.name}
							</h1>
							<p className="text-muted-foreground text-sm">
								{submission.summary}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<LifecycleStatusBadge
							status={pluginLifecycleStatus(project)}
						/>
						<ModerationStatusBadge
							status={pluginModerationStatus(project)}
						/>
						<Badge variant="outline">{project.visibility}</Badge>
						<PluginReviewStatusBadge
							status={releases[0]?.status ?? 'notSubmitted'}
						/>
					</div>
				</header>
			}
			identity={{
				contentId: project._id,
				revision: project.submissionRevision ?? 0,
				pending: project.submissionStatus === 'pending',
			}}
			note={project.submissionReason ?? project.moderationReason}
			submissionRevision={project.submissionRevision}
			submissionStatus={project.submissionStatus}
			submittedAt={project.submittedAt}
		>
			<ReviewSectionPanel active={nav.section === 'overview'}>
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Submission details</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid gap-6 text-sm sm:grid-cols-2 xl:grid-cols-3">
								<div>
									<dt className="text-muted-foreground">
										Server software
									</dt>
									<dd>{software?.name ?? 'Unknown'}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">
										License
									</dt>
									<dd>
										{submission.license ?? 'Not specified'}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">
										Repository
									</dt>
									<dd className="break-all">
										{repository ? (
											<a
												className="hover:underline"
												href={repository.htmlUrl}
												rel="noreferrer"
												target="_blank"
											>
												{repository.fullName}
											</a>
										) : (
											'Unavailable'
										)}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">
										Updated
									</dt>
									<dd>{formatDate(submission.updatedAt)}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">
										Plugin ID
									</dt>
									<dd className="break-all font-mono text-xs">
										{project._id}
									</dd>
								</div>
							</dl>
							{submission.licenseCustom ? (
								<p className="mt-4 whitespace-pre-line border-t pt-4 text-muted-foreground text-xs">
									{submission.licenseCustom}
								</p>
							) : null}
						</CardContent>
					</Card>
				</div>
			</ReviewSectionPanel>
			<ReviewSectionPanel active={nav.section === 'changes'}>
				<AdminSubmissionHistory
					contentId={project._id}
					contentType="plugin"
					mode="changes"
					revision={project.submissionRevision}
				/>
			</ReviewSectionPanel>
			<ReviewSectionPanel active={nav.section === 'description'}>
				<Card>
					<CardHeader>
						<CardTitle>Submitted description</CardTitle>
					</CardHeader>
					<CardContent>
						{submission.description?.trim() ? (
							<RichTextViewer
								content={submission.description}
								relativeUrlBase={relativeUrlBase}
							/>
						) : (
							<p className="text-muted-foreground text-sm">
								No description supplied.
							</p>
						)}
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
							items={gallery}
						/>
					</CardContent>
				</Card>
			</ReviewSectionPanel>
			<div className="space-y-6" hidden={nav.section !== 'versions'}>
				<ReviewVersionsTable
					emptyMessage="The creator has not submitted a release for review yet."
					openId={
						nav.releaseId ??
						releases.find(
							(release) => release.status === 'inReview',
						)?._id
					}
					rows={releases.map((release) =>
						pluginReleaseRow(release, {
							publicationBlocked:
								project.visibility === 'hidden' ||
								project.visibility === 'suspended' ||
								project.status === 'draft',
							relativeUrlBase,
							repositoryUrl: repository?.htmlUrl,
							submissionRevision: project.submissionRevision,
						}),
					)}
				/>
			</div>
			<ReviewSectionPanel active={nav.section === 'links'}>
				<SubmissionMetadata
					fields={[
						[
							'Categories',
							detail.categories
								.map((category) => category.name)
								.join(', '),
						],
					]}
					links={[
						['Website', submission.websiteUrl],
						['Wiki', submission.wikiUrl],
						['Discord', submission.discordUrl],
						['Issue tracker', submission.issuesUrl],
						['Donations', submission.donationUrl],
					]}
				/>
			</ReviewSectionPanel>
			<ReviewSectionPanel active={nav.section === 'history'}>
				<AdminSubmissionHistory
					contentId={project._id}
					contentType="plugin"
					mode="history"
					revision={project.submissionRevision}
				/>
			</ReviewSectionPanel>
		</AdminReviewShell>
	)
}
