'use client'

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

export interface ListingDeletion {
	name: string
	/** What the owner types to confirm, usually the slug. */
	confirmText: string
	/** What is removed, and what is not. */
	description: string
	/** Deletes, then navigates away; throws to keep the dialog open. */
	onDelete: (confirmation: string) => Promise<void>
}

/** Permanent deletion of a server, project or plugin, confirmed by typing. */
export function DeleteListingDialog({
	deletion,
	open,
	onOpenChange,
}: {
	deletion: ListingDeletion
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const [confirmation, setConfirmation] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)

	const submit = async () => {
		setIsDeleting(true)
		try {
			await deletion.onDelete(confirmation.trim())
			toast.success(`${deletion.name} deleted.`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'It could not be deleted.',
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
					<AlertDialogTitle>Delete {deletion.name}?</AlertDialogTitle>
					<AlertDialogDescription>
						{deletion.description} This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="flex flex-col gap-2">
					<Label htmlFor="delete-listing-confirmation">
						Type{' '}
						<span className="font-mono font-semibold">
							{deletion.confirmText}
						</span>{' '}
						to confirm
					</Label>
					<Input
						autoComplete="off"
						disabled={isDeleting}
						id="delete-listing-confirmation"
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
							isDeleting ||
							confirmation.trim() !== deletion.confirmText
						}
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
