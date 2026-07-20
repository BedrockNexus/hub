'use client'

import {
	Delete02Icon,
	Download04Icon,
	Package01Icon,
	Refresh01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { formatDate } from '@/lib/format'

function formatBytes(bytes: number): string {
	if (bytes === 0) {
		return '0 B'
	}
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(1024))
	return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`
}

interface ProjectVersionsFormProps {
	slug: string
	projectId: Id<'projects'>
}

function VersionValidationBadge({ status }: { status?: string }) {
	let label = 'Valid'
	let variant: 'destructive' | 'outline' | 'secondary' = 'outline'
	if (status === 'invalid') {
		label = 'Rejected'
		variant = 'destructive'
	} else if (status === 'validating') {
		label = 'Validating'
		variant = 'secondary'
	} else if (status === 'pending') {
		label = 'Pending'
		variant = 'secondary'
	}

	return <Badge variant={variant}>{label}</Badge>
}

function VersionDownloadButton({
	downloadUrl,
	fileName,
}: {
	downloadUrl?: string
	fileName: string
}) {
	if (!downloadUrl) {
		return null
	}

	return (
		<Button
			nativeButton={false}
			render={
				<a
					aria-label={`Download ${fileName}`}
					href={downloadUrl}
					rel="noreferrer"
					target="_blank"
				/>
			}
			size="sm"
			variant="outline"
		>
			<HugeiconsIcon className="size-4" icon={Download04Icon} />
			Download
		</Button>
	)
}

function RetryValidationButton({
	isLoading,
	onRetry,
	visible,
}: {
	isLoading: boolean
	onRetry: () => void
	visible: boolean
}) {
	if (!visible) {
		return null
	}

	return (
		<Button
			disabled={isLoading}
			onClick={onRetry}
			size="sm"
			type="button"
			variant="outline"
		>
			{isLoading ? (
				<Spinner className="size-4" />
			) : (
				<HugeiconsIcon className="size-4" icon={Refresh01Icon} />
			)}
			Retry
		</Button>
	)
}

export function ProjectVersionsForm({
	slug,
	projectId,
}: ProjectVersionsFormProps) {
	const versions = useQuery(api.functions.projects.versions.list, {
		projectId,
	})
	const deleteVersion = useAction(
		api.functions.projects.artifactDelivery.remove,
	)
	const retryValidation = useMutation(
		api.functions.projects.versions.retryValidation,
	)
	const [deletingId, setDeletingId] = useState<Id<'projectVersions'> | null>(
		null,
	)
	const [retryingId, setRetryingId] = useState<Id<'projectVersions'> | null>(
		null,
	)

	const handleDelete = async (id: Id<'projectVersions'>, version: string) => {
		setDeletingId(id)
		try {
			await deleteVersion({ id })
			toast.success(`Version ${version} deleted`)
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : 'Failed to delete version',
			)
		} finally {
			setDeletingId(null)
		}
	}

	const handleRetryValidation = async (id: Id<'projectVersions'>) => {
		setRetryingId(id)
		try {
			await retryValidation({ versionId: id })
			toast.success('Artifact validation queued again')
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: 'Failed to retry validation',
			)
		} finally {
			setRetryingId(null)
		}
	}

	const renderVersionsContent = () => {
		if (versions === undefined) {
			return (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: skeleton list
						<Skeleton className="h-16 w-full rounded-lg" key={i} />
					))}
				</div>
			)
		}

		if (versions.length === 0) {
			return (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No versions yet</EmptyTitle>
						<EmptyDescription>
							Publish your first version to let users download
							your project.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)
		}

		return (
			<div className="divide-y rounded-lg border">
				{versions.map((version) => (
					<div
						className="flex items-center justify-between gap-4 p-4"
						key={version._id}
					>
						<div className="min-w-0 flex-1 space-y-1">
							<div className="flex items-center gap-2">
								<span className="font-mono font-semibold text-sm">
									v{version.version}
								</span>
								<VersionValidationBadge
									status={version.validationStatus}
								/>
								{version.gameVersions &&
									version.gameVersions.length > 0 && (
										<div className="flex flex-wrap gap-1">
											{version.gameVersions.map((gv) => (
												<Badge
													key={gv}
													variant="secondary"
												>
													{gv}
												</Badge>
											))}
										</div>
									)}
							</div>
							<p className="truncate text-muted-foreground text-xs">
								{version.fileName} &bull;{' '}
								{formatBytes(version.fileSize)} &bull;{' '}
								<HugeiconsIcon
									className="inline size-3"
									icon={Download04Icon}
								/>{' '}
								{version.downloads.toLocaleString()} &bull;{' '}
								{formatDate(version.createdAt)}
							</p>
							{version.validationError && (
								<p className="text-destructive text-xs">
									{version.validationError}
								</p>
							)}
						</div>

						<div className="flex items-center gap-2">
							<RetryValidationButton
								isLoading={retryingId === version._id}
								onRetry={() =>
									handleRetryValidation(version._id)
								}
								visible={
									version.validationCode ===
									'VALIDATOR_UNAVAILABLE'
								}
							/>
							<VersionDownloadButton
								downloadUrl={version.downloadUrl}
								fileName={version.fileName}
							/>

							<AlertDialog>
								<AlertDialogTrigger
									render={
										<Button
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
											disabled={
												deletingId === version._id
											}
											nativeButton={true}
											size="icon"
											variant="ghost"
										/>
									}
								>
									{deletingId === version._id ? (
										<Spinner className="size-4" />
									) : (
										<HugeiconsIcon
											className="size-4"
											icon={Delete02Icon}
										/>
									)}
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Delete version {version.version}?
										</AlertDialogTitle>
										<AlertDialogDescription>
											This will permanently delete the
											version file and all associated
											data. This action cannot be undone.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											Cancel
										</AlertDialogCancel>
										<AlertDialogAction
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											onClick={() =>
												handleDelete(
													version._id,
													version.version,
												)
											}
										>
											Delete
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</div>
				))}
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-lg">Versions</h2>
					<p className="text-muted-foreground text-sm">
						Manage published versions of your project
					</p>
				</div>
				<Button
					nativeButton={false}
					render={
						<Link
							href={`/dashboard/projects/${slug}/edit/versions/add`}
						/>
					}
				>
					<HugeiconsIcon className="size-4" icon={Package01Icon} />
					Publish New Version
				</Button>
			</div>

			{renderVersionsContent()}
		</div>
	)
}
