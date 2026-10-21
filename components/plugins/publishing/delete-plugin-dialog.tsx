'use client'

import { useMutation } from 'convex/react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

/**
 * Permanently deletes a plugin and its catalog data after the owner types its
 * slug. The GitHub repository and its releases are not changed.
 */
export function DeletePluginDialog({
	draftId,
	name,
	slug,
	open,
	onOpenChange,
}: {
	draftId: Id<'pluginPublishingDrafts'>
	name: string
	slug: string
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const router = useRouter()
	const deletePlugin = useMutation(
		api.functions.plugins.deletion.deleteProject,
	)
	const [confirmation, setConfirmation] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)

	const submit = async () => {
		setIsDeleting(true)
		try {
			await deletePlugin({ draftId, confirmSlug: confirmation })
			toast.success('Plugin deleted.')
			router.push('/dashboard/plugins' as Route)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'The plugin could not be deleted.',
			)
			setIsDeleting(false)
		}
	}

	return (
		<AlertDialog
			onOpenChange={(next) => {
				if (!isDeleting) {
					onOpenChange(next)
					setConfirmation('')
				}
			}}
			open={open}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {name}?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes the plugin, its versions,
						files, reviews and download history from BedrockNexus.
						Your GitHub repository and its releases are not changed.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="flex flex-col gap-2">
					<Label htmlFor="delete-plugin-confirmation">
						Type{' '}
						<span className="font-mono font-semibold">{slug}</span>{' '}
						to confirm
					</Label>
					<Input
						autoComplete="off"
						disabled={isDeleting}
						id="delete-plugin-confirmation"
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
						disabled={isDeleting || confirmation.trim() !== slug}
						onClick={submit}
						variant="destructive"
					>
						{isDeleting ? (
							<Spinner data-icon="inline-start" />
						) : null}
						Delete permanently
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
