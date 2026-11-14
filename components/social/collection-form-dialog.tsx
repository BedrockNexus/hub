'use client'

import { useMutation } from 'convex/react'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { userFacingError } from '@/lib/user-facing-error'

export type CollectionVisibility = 'public' | 'unlisted' | 'private'

export const VISIBILITY_OPTIONS: {
	value: CollectionVisibility
	label: string
	description: string
}[] = [
	{
		value: 'public',
		label: 'Public',
		description: 'On your profile and in the collection directory.',
	},
	{
		value: 'unlisted',
		label: 'Unlisted',
		description: 'Only people with the link can open it.',
	},
	{
		value: 'private',
		label: 'Private',
		description: 'Only you can see it.',
	},
]

interface CollectionFormDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Editing an existing collection; creates a new one when absent. */
	collection?: {
		_id: Id<'collections'>
		name: string
		description?: string
		visibility: CollectionVisibility
	}
	onCreated?: (
		collectionId: Id<'collections'>,
		name: string,
		publicId: string,
	) => void | Promise<void>
}

export function CollectionFormDialog({
	open,
	onOpenChange,
	collection,
	onCreated,
}: CollectionFormDialogProps) {
	const create = useMutation(api.functions.social.collections.create)
	const update = useMutation(api.functions.social.collections.update)
	const [name, setName] = useState(collection?.name ?? '')
	const [description, setDescription] = useState(
		collection?.description ?? '',
	)
	const [visibility, setVisibility] = useState<CollectionVisibility>(
		collection?.visibility ?? 'public',
	)
	const [pending, setPending] = useState(false)

	// Start from the collection's current values each time the dialog opens.
	useEffect(() => {
		if (!open) {
			return
		}
		setName(collection?.name ?? '')
		setDescription(collection?.description ?? '')
		setVisibility(collection?.visibility ?? 'public')
	}, [open, collection])

	const onSubmit = async (event: FormEvent) => {
		event.preventDefault()
		setPending(true)
		try {
			if (collection) {
				await update({
					collectionId: collection._id,
					name,
					description,
					visibility,
				})
				toast.success('Collection saved')
			} else {
				const created = await create({ name, description, visibility })
				toast.success('Collection created')
				await onCreated?.(created._id, name.trim(), created.publicId)
			}
			onOpenChange(false)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not save the collection'))
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{collection ? 'Edit collection' : 'New collection'}
					</DialogTitle>
					<DialogDescription>
						Group add-ons, resource packs, plugins and servers to
						share or come back to.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-5" onSubmit={onSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="collection-name">
								Name
							</FieldLabel>
							<Input
								autoFocus
								id="collection-name"
								maxLength={60}
								onChange={(event) =>
									setName(event.target.value)
								}
								required
								value={name}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="collection-description">
								Description
							</FieldLabel>
							<Textarea
								id="collection-description"
								maxLength={500}
								onChange={(event) =>
									setDescription(event.target.value)
								}
								rows={3}
								value={description}
							/>
							<FieldDescription>
								Optional, up to 500 characters.
							</FieldDescription>
						</Field>
						<FieldSet>
							<FieldLegend variant="label">
								Who can see it
							</FieldLegend>
							<RadioGroup
								onValueChange={(value) =>
									setVisibility(value as CollectionVisibility)
								}
								value={visibility}
							>
								{VISIBILITY_OPTIONS.map((option) => (
									<FieldLabel
										htmlFor={`collection-visibility-${option.value}`}
										key={option.value}
									>
										<Field orientation="horizontal">
											<RadioGroupItem
												id={`collection-visibility-${option.value}`}
												value={option.value}
											/>
											<FieldContent>
												<FieldTitle>
													{option.label}
												</FieldTitle>
												<FieldDescription>
													{option.description}
												</FieldDescription>
											</FieldContent>
										</Field>
									</FieldLabel>
								))}
							</RadioGroup>
						</FieldSet>
					</FieldGroup>
					<DialogFooter>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={pending || !name.trim()}
							type="submit"
						>
							{collection ? 'Save' : 'Create'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
