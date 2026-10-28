'use client'

import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { MapReleaseDetails } from '@/components/projects/detail/map-release-details'
import { MapValidationSummary } from '@/components/projects/detail/map-validation-summary'
import { ProjectTypeDetailsCard } from '@/components/projects/detail/project-type-details-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { contentEditHref } from '@/lib/content-routes'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
} from '@/lib/project-artifacts'
import { projectSubmissionChecklist } from '@/lib/project-submission'

export function ProjectSubmissionReview({ id }: { id: Id<'projects'> }) {
	const project = useQuery(api.functions.projects.projects.getForEdit, { id })
	const versions = useQuery(
		api.functions.projects.versions.list,
		project ? { projectId: id } : 'skip',
	)
	const gallery = useQuery(
		api.functions.projects.gallery.listMine,
		project ? { projectId: id } : 'skip',
	)
	const update = useMutation(api.functions.projects.projects.update)
	const [submitting, setSubmitting] = useState(false)
	if (project === undefined) {
		return <Skeleton className="h-96 w-full" />
	}
	if (!project) {
		return <p>Listing not found or unavailable.</p>
	}
	const base = contentEditHref(project.type, id)
	const checks = projectSubmissionChecklist({
		...project,
		hasGallery: !!gallery?.length,
	})
	const ready = checks.every((check) => !check.required || check.complete)
	const canSubmit =
		project.status === 'draft' && project.moderationStatus !== 'rejected'
	let statusMessage =
		'Your listing is published. New releases are reviewed separately; the approved release stays available.'
	if (project.moderationStatus === 'rejected') {
		statusMessage =
			'This submission was rejected. Contact the moderators about the decision.'
	} else if (project.status === 'under_review') {
		statusMessage = 'Your submission is awaiting moderator review.'
	}
	const submit = async () => {
		setSubmitting(true)
		try {
			await update({ id, status: 'under_review' })
			toast.success(`${project.name} submitted for review`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not submit for review',
			)
		} finally {
			setSubmitting(false)
		}
	}
	return (
		<div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
			<div>
				<h1 className="font-semibold text-2xl">Preview & submission</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Review your saved listing before submitting. You can return
					to this draft from your dashboard.
				</p>
			</div>
			{project.moderationReason ? (
				<Alert>
					<AlertTitle>Moderator feedback</AlertTitle>
					<AlertDescription className="whitespace-pre-line">
						{project.moderationReason}
					</AlertDescription>
				</Alert>
			) : null}
			<Card>
				<CardHeader>
					<CardTitle>Submission checklist</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<ul className="space-y-3">
						{checks.map((check) => (
							<li
								className="flex flex-wrap items-center justify-between gap-2 text-sm"
								key={check.label}
							>
								<span>
									<span aria-hidden>
										{check.complete ? '✓' : '○'}
									</span>{' '}
									<span className="sr-only">
										{check.complete
											? 'Complete: '
											: 'Incomplete: '}
									</span>
									{check.label}{' '}
									<span className="text-muted-foreground">
										(
										{check.required
											? 'required'
											: 'recommended'}
										)
									</span>
								</span>
								<Link
									className="font-medium underline underline-offset-4"
									href={`${base}${check.section}`}
								>
									{check.complete ? 'Edit' : 'Complete'}
								</Link>
							</li>
						))}
					</ul>
					{canSubmit ? (
						<>
							<p className="text-muted-foreground text-sm">
								Submission starts moderator review. Files become
								public after validation and approval.
							</p>
							<Button
								disabled={!ready || submitting}
								onClick={submit}
								type="button"
							>
								{submitting
									? 'Submitting…'
									: 'Submit for review'}
							</Button>
						</>
					) : (
						<p className="text-muted-foreground text-sm">
							{statusMessage}
						</p>
					)}
				</CardContent>
			</Card>
			<div className="border-t pt-6">
				<p className="mb-3 text-muted-foreground text-sm">
					Private preview of saved content
				</p>
				<Badge variant="outline">
					{PROJECT_TYPE_LABELS[normalizeProjectType(project.type)]}
				</Badge>
				{project.iconUrl ? (
					<Image
						alt=""
						className="mt-3 rounded-md object-cover"
						height={64}
						src={project.iconUrl}
						width={64}
					/>
				) : null}
				<h2 className="mt-3 font-bold text-3xl">{project.name}</h2>
				<p className="mt-2 text-muted-foreground">{project.summary}</p>
				<p className="mt-3 text-muted-foreground text-sm">
					License: {project.license || 'Not specified'}
				</p>
			</div>
			<ProjectTypeDetailsCard metadata={project.metadata} />
			<Card>
				<CardHeader>
					<CardTitle>Description</CardTitle>
				</CardHeader>
				<CardContent>
					<RichTextViewer content={project.description} />
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
			<Card>
				<CardHeader>
					<CardTitle>Releases</CardTitle>
				</CardHeader>
				<CardContent>
					{versions === undefined ? (
						<Skeleton className="h-20" />
					) : (
						<ul className="space-y-3">
							{versions.map((version) => (
								<li
									className="space-y-1 text-sm"
									key={version._id}
								>
									<p className="font-medium">
										{version.version} · {version.fileName}
									</p>
									<p className="text-muted-foreground">
										Validation:{' '}
										{version.validationStatus ??
											(project.type === 'map'
												? 'pending'
												: 'valid')}{' '}
										· Review:{' '}
										{version.reviewStatus ??
											(project.type === 'map'
												? 'pending'
												: 'approved')}{' '}
										· Bedrock:{' '}
										{version.gameVersions?.join(', ') ||
											'Not specified'}
									</p>
									<MapReleaseDetails
										metadata={version.releaseMetadata}
										version={version.version}
									/>
									<MapValidationSummary
										report={version.mapValidationReport}
									/>
									{version.validationError ||
									version.reviewReason ? (
										<p className="text-destructive">
											{version.validationError ||
												version.reviewReason}
										</p>
									) : null}
								</li>
							))}
							{versions.length === 0 ? (
								<li>
									No releases uploaded.{' '}
									<Link
										className="underline"
										href={`${base}/versions/add`}
									>
										Add your first release
									</Link>
								</li>
							) : null}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
