'use client'

import { Alert02Icon, ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { AdminModerationActions } from '@/components/admin-dashboard/admin-moderation-actions'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function formatBytes(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AdminProjectReview({ projectId }: { projectId: string }) {
	const project = useQuery(api.functions.projects.projects.getAdminReview, {
		id: projectId as Id<'projects'>,
	})

	if (project === undefined) {
		return <Skeleton className="h-[70svh] w-full rounded-lg" />
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

	const hasVersionFiles = project.versions.length > 0
	const versionApprovalMessage =
		'The creator must upload at least one project version file before this project can be approved.'

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-3">
					<Button
						nativeButton={false}
						render={<Link href="/admin/projects" />}
						variant="ghost"
					>
						<HugeiconsIcon
							className="size-4"
							icon={ArrowLeft02Icon}
						/>
						Projects
					</Button>
					<div className="flex items-center gap-4">
						{project.iconUrl ? (
							<Image
								alt={`${project.name} icon`}
								className="size-16 rounded-lg border object-cover"
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
						<ModerationStatusBadge
							status={project.moderationStatus}
						/>
						<Badge variant="outline">
							{project.type.replace('_', ' ')}
						</Badge>
					</div>
				</div>
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
				/>
			</div>

			{project.moderationReason ? (
				<Card className="border-destructive/40">
					<CardHeader>
						<CardTitle className="text-base">
							Current moderation note
						</CardTitle>
					</CardHeader>
					<CardContent className="text-sm">
						{project.moderationReason}
					</CardContent>
				</Card>
			) : null}

			{hasVersionFiles ? null : (
				<Alert>
					<HugeiconsIcon className="size-4" icon={Alert02Icon} />
					<AlertTitle>Version file required</AlertTitle>
					<AlertDescription>
						{versionApprovalMessage}
					</AlertDescription>
				</Alert>
			)}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="space-y-6">
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
								emptyDescription="No screenshots were supplied."
								emptyTitle="No gallery images"
								items={project.gallery}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Versions and files</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Version</TableHead>
										<TableHead>File</TableHead>
										<TableHead>Game versions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{project.versions.map((version) => (
										<TableRow key={version._id}>
											<TableCell className="font-medium">
												{version.version}
											</TableCell>
											<TableCell>
												{version.fileName}
												<span className="ml-2 text-muted-foreground text-xs">
													{formatBytes(
														version.fileSize,
													)}
												</span>
											</TableCell>
											<TableCell>
												{version.gameVersions?.join(
													', ',
												) || 'Not specified'}
											</TableCell>
										</TableRow>
									))}
									{project.versions.length === 0 ? (
										<TableRow>
											<TableCell
												className="h-24 text-center text-muted-foreground"
												colSpan={3}
											>
												No version files uploaded
											</TableCell>
										</TableRow>
									) : null}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>

				<Card className="h-fit">
					<CardHeader>
						<CardTitle className="text-base">
							Submission details
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
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
							<p className="text-muted-foreground">Categories</p>
							<p>
								{project.categories
									.map((category) => category?.name)
									.filter(Boolean)
									.join(', ') || 'None'}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
