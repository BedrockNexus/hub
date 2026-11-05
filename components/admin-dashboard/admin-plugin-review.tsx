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
import { AdminPluginReleaseReview } from '@/components/admin-dashboard/admin-plugin-release-review'
import { PluginReviewStatusBadge } from '@/components/admin-dashboard/plugin-review-status'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { formatDate } from '@/lib/format'
import {
	pluginLifecycleStatus,
	pluginModerationStatus,
} from '@/lib/plugins/moderation-state'
import { AdminSubmissionHistory } from './admin-submission-history'
import { SubmissionMetadata } from './submission-metadata'
import { SubmissionStatusBadge } from './submission-status'

export function AdminPluginReview({ pluginId }: { pluginId: string }) {
	const detail = useQuery(api.functions.plugins.projects.getAdminReview, {
		id: pluginId,
	})
	if (detail === undefined) {
		return <Skeleton className="h-[70svh] w-full rounded-md" />
	}
	const back = (
		<Button
			nativeButton={false}
			render={<Link href="/admin/plugins" />}
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
		<div className="space-y-6">
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
				<SubmissionStatusBadge status={project.submissionStatus} />
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
			</header>
			{(project.submissionReason ?? project.moderationReason) ? (
				<Card className="border-destructive/40">
					<CardHeader>
						<CardTitle>Current moderation note</CardTitle>
					</CardHeader>
					<CardContent className="whitespace-pre-wrap text-sm">
						{project.submissionReason ?? project.moderationReason}
					</CardContent>
				</Card>
			) : null}
			<AdminSubmissionHistory
				contentId={project._id}
				contentType="plugin"
				revision={project.submissionRevision}
			/>
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
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="min-w-0 space-y-6">
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
					<section
						aria-label="Submitted releases"
						className="space-y-4"
					>
						<h2 className="font-semibold text-xl">Releases</h2>
						{releases.length ? (
							releases.map((release) => (
								<AdminPluginReleaseReview
									key={release._id}
									publicationBlocked={
										project.visibility === 'hidden' ||
										project.visibility === 'suspended' ||
										project.status === 'draft'
									}
									relativeUrlBase={relativeUrlBase}
									release={release}
									repositoryUrl={repository?.htmlUrl}
									submissionRevision={
										project.submissionRevision
									}
								/>
							))
						) : (
							<Card>
								<CardContent className="py-8 text-muted-foreground text-sm">
									The creator has not submitted a release for
									review yet.
								</CardContent>
							</Card>
						)}
					</section>
				</div>
				<aside className="min-w-0 space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Submission details</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="space-y-4 text-sm">
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
				</aside>
			</div>
		</div>
	)
}
