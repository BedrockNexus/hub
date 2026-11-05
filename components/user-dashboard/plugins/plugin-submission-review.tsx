'use client'

import { useConvexAuth, useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ListingReviewNotice } from '@/components/user-dashboard/listing-review-state'
import { ListingSubmissionChecklist } from '@/components/user-dashboard/listing-submission-checklist'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useMinute } from '@/hooks/use-minute'
import { creatorListingState } from '@/lib/creator-listing-state'
import { createPluginDashboardId } from '@/lib/plugins/plugin-dashboard-id'
import { projectMetadataSchema } from '@/lib/plugins/publishing/metadata'
import { usePluginForEdit } from './edit/plugin-edit-data'
export function PluginSubmissionReview({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const plugin = usePluginForEdit(draftId)
	const auth = useConvexAuth()
	const now = useMinute()
	const builds = useQuery(
		api.functions.plugins.publishing.model.listBuilds,
		auth.isAuthenticated ? { draftId, now } : 'skip',
	)
	const gallery = useQuery(
		api.functions.plugins.gallery.listMine,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	if (!plugin) {
		return <Skeleton className="h-96 w-full" />
	}
	const { draft, repository } = plugin
	const base = `/dashboard/plugins/${createPluginDashboardId(repository.githubRepositoryId)}`
	const state = creatorListingState({
		...plugin.project,
		locked: plugin.locked,
	})
	const checks = [
		{
			label: 'Name and summary',
			section: '',
			complete: projectMetadataSchema.safeParse(draft).success,
			required: true,
		},
		{
			label: 'Build workflow installed',
			section: '/workflow',
			complete: !!draft.workflowInstalled,
			required: true,
		},
		{
			label: 'Build available for submission',
			section: '/versions',
			complete: !!builds?.some(
				(build) =>
					build.publishable &&
					(!build.release ||
						['changesRequested', 'preparationFailed'].includes(
							build.release.status,
						)),
			),
			required: true,
		},
		{
			label: 'Description',
			section: '/description',
			complete: !!draft.description?.trim(),
			required: false,
		},
		{
			label: 'At least one category',
			section: '/categories',
			complete: !!draft.categoryIds?.length,
			required: false,
		},
		{
			label: 'Listing icon',
			section: '',
			complete: !!draft.iconUrl,
			required: false,
		},
		{
			label: 'License',
			section: '/license',
			complete: !!draft.license,
			required: false,
		},
	]
	checks.push({
		label: 'Screenshots',
		section: '/gallery',
		complete: !!gallery?.length,
		required: false,
	})
	const ready = checks.every((check) => !check.required || check.complete)
	return (
		<div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
			<div>
				<h1 className="font-semibold text-2xl">
					Preview &amp; submission
				</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Review your saved listing before submitting. You can return
					to this draft from your dashboard.
				</p>
			</div>
			<ListingReviewNotice
				listing={{
					...plugin.project,
					locked: plugin.locked,
					moderationReason: plugin.moderationNote,
				}}
			/>
			<ListingSubmissionChecklist basePath={base} checks={checks}>
				{state.canSubmit ? (
					<>
						<p className="text-muted-foreground text-sm">
							Choose a build, enter its version and changelog,
							then submit it for moderator review. Your saved
							listing is reviewed with that version.
						</p>
						{ready ? (
							<Button
								nativeButton={false}
								render={<Link href={`${base}/versions`} />}
							>
								{state.review === 'changes_requested' ||
								state.review === 'rejected'
									? 'Choose a build to resubmit'
									: 'Choose a build to submit'}
							</Button>
						) : (
							<p className="text-muted-foreground text-sm">
								Complete the required items before submitting.
							</p>
						)}
					</>
				) : null}
			</ListingSubmissionChecklist>
			<div className="border-t pt-6">
				<p className="mb-3 text-muted-foreground text-sm">
					Private preview of saved content
				</p>
				{draft.iconUrl ? (
					<Image
						alt=""
						className="rounded-md object-cover"
						height={64}
						src={draft.iconUrl}
						width={64}
					/>
				) : null}
				<h2 className="mt-3 font-bold text-3xl">{draft.name}</h2>
				<p className="mt-2 text-muted-foreground">{draft.summary}</p>
				<p className="mt-3 text-muted-foreground text-sm">
					License: {draft.license || 'Not specified'}
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Description</CardTitle>
				</CardHeader>
				<CardContent>
					<RichTextViewer content={draft.description ?? ''} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Gallery</CardTitle>
				</CardHeader>
				<CardContent>
					<GalleryGrid
						emptyDescription="Screenshots help players understand your content."
						emptyTitle="No screenshots yet"
						items={gallery}
					/>
				</CardContent>
			</Card>
		</div>
	)
}
