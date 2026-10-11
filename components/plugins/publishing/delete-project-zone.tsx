'use client'

import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

/** Owner-facing permanent deletion of a project and its catalog data. */
export function DeleteProjectZone({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const router = useRouter()
	const project = useQuery(api.functions.plugins.publishing.model.getMine, {
		draftId,
	})
	const deleteProject = useMutation(
		api.functions.plugins.deletion.deleteProject,
	)
	const [open, setOpen] = useState(false)
	const [confirmation, setConfirmation] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)

	if (!project) {
		return null
	}
	const slug = project.draft.slug

	const submit = async () => {
		setIsDeleting(true)
		try {
			await deleteProject({ draftId, confirmSlug: confirmation })
			toast.success('Project deleted.')
			router.push('/dashboard/plugins' as Route)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'The project could not be deleted.',
			)
			setIsDeleting(false)
		}
	}

	return (
		<Card className="mt-10 border-destructive/40 shadow-none">
			<CardHeader>
				<CardTitle>Delete project</CardTitle>
				<CardDescription>
					Permanently removes this project, its releases, and its
					download history from BedrockNexus. Your GitHub repository,
					releases, and files are not changed.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button onClick={() => setOpen(true)} variant="destructive">
					<HugeiconsIcon className="size-4" icon={Delete02Icon} />
					Delete project
				</Button>
			</CardContent>

			<AlertDialog
				onOpenChange={(next) => {
					if (!isDeleting) {
						setOpen(next)
						setConfirmation('')
					}
				}}
				open={open}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {project.draft.name}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This cannot be undone. The project disappears from
							the catalog immediately.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-2">
						<Label htmlFor="delete-project-confirmation">
							Type{' '}
							<span className="font-mono font-semibold">
								{slug}
							</span>{' '}
							to confirm
						</Label>
						<Input
							autoComplete="off"
							disabled={isDeleting}
							id="delete-project-confirmation"
							onChange={(event) =>
								setConfirmation(event.target.value)
							}
							value={confirmation}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>
							Cancel
						</AlertDialogCancel>
						<Button
							disabled={
								isDeleting || confirmation.trim() !== slug
							}
							onClick={submit}
							variant="destructive"
						>
							{isDeleting ? <Spinner className="size-4" /> : null}
							Delete permanently
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	)
}
