'use client'

import {
	Delete02Icon,
	Folder01Icon,
	PencilEdit02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	CollectionFormDialog,
	VISIBILITY_OPTIONS,
} from '@/components/social/collection-form-dialog'
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
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { WorkspacePageHeader } from '@/components/workspace-page-header'
import { api } from '@/convex/_generated/api'
import { userFacingError } from '@/lib/user-facing-error'

type Collection = FunctionReturnType<
	typeof api.functions.social.collections.listMine
>[number]

function CollectionRow({
	collection,
	onEdit,
}: {
	collection: Collection
	onEdit: (collection: Collection) => void
}) {
	const remove = useMutation(api.functions.social.collections.remove)
	const visibility = VISIBILITY_OPTIONS.find(
		(option) => option.value === collection.visibility,
	)

	const onDelete = async () => {
		try {
			await remove({ collectionId: collection._id })
			toast.success('Collection deleted')
		} catch (error) {
			toast.error(
				userFacingError(error, 'Could not delete the collection'),
			)
		}
	}

	return (
		<li className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
			<div className="grid size-11 shrink-0 place-items-center rounded-md bg-stone text-white">
				<HugeiconsIcon
					aria-hidden
					className="size-5"
					icon={Folder01Icon}
				/>
			</div>
			<div className="min-w-0 flex-[1_1_12rem]">
				<Link
					className="block truncate font-semibold hover:text-ember-text"
					href={`/collections/${collection.publicId}` as Route}
				>
					{collection.name}
				</Link>
				<p className="text-muted-foreground text-sm">
					{collection.itemCount === 1
						? '1 item'
						: `${collection.itemCount.toLocaleString()} items`}
					{collection.followerCount > 0
						? ` · ${collection.followerCount.toLocaleString()} followers`
						: ''}
				</p>
			</div>
			<Badge variant="outline">{visibility?.label}</Badge>
			<div className="flex gap-2">
				<Button
					aria-label={`Edit ${collection.name}`}
					onClick={() => onEdit(collection)}
					size="icon-sm"
					type="button"
					variant="outline"
				>
					<HugeiconsIcon icon={PencilEdit02Icon} />
				</Button>
				<AlertDialog>
					<AlertDialogTrigger
						render={
							<Button
								aria-label={`Delete ${collection.name}`}
								size="icon-sm"
								type="button"
								variant="destructive"
							/>
						}
					>
						<HugeiconsIcon icon={Delete02Icon} />
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								Delete “{collection.name}”?
							</AlertDialogTitle>
							<AlertDialogDescription>
								The collection and its notes are removed for
								everyone. The listings in it are not affected.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={onDelete}
								variant="destructive"
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</li>
	)
}

function CollectionList({
	collections,
	onCreate,
	onEdit,
}: {
	collections: Collection[] | undefined
	onCreate: () => void
	onEdit: (collection: Collection) => void
}) {
	if (collections === undefined) {
		return (
			<div className="space-y-2">
				<Skeleton className="h-16" />
				<Skeleton className="h-16" />
			</div>
		)
	}
	if (collections.length === 0) {
		return (
			<Empty className="border border-dashed py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={Folder01Icon} />
					</EmptyMedia>
					<EmptyTitle>No collections yet</EmptyTitle>
					<EmptyDescription>
						Make one here, or use the folder button on any listing.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button onClick={onCreate} type="button">
						New collection
					</Button>
				</EmptyContent>
			</Empty>
		)
	}
	return (
		<ul className="space-y-2">
			{collections.map((collection) => (
				<CollectionRow
					collection={collection}
					key={collection._id}
					onEdit={onEdit}
				/>
			))}
		</ul>
	)
}

export default function CollectionsPage() {
	const collections = useQuery(api.functions.social.collections.listMine, {})
	const [editing, setEditing] = useState<Collection | null>(null)
	const [creating, setCreating] = useState(false)

	return (
		<div className="space-y-6">
			<WorkspacePageHeader
				actions={
					<Button onClick={() => setCreating(true)} type="button">
						New collection
					</Button>
				}
				description="Lists of add-ons, resource packs, plugins and servers. Share public ones, or keep them private."
				title="Collections"
			/>
			<CollectionList
				collections={collections}
				onCreate={() => setCreating(true)}
				onEdit={setEditing}
			/>
			<CollectionFormDialog onOpenChange={setCreating} open={creating} />
			<CollectionFormDialog
				collection={editing ?? undefined}
				onOpenChange={(open) => {
					if (!open) {
						setEditing(null)
					}
				}}
				open={editing !== null}
			/>
		</div>
	)
}
