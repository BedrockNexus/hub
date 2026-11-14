'use client'

import { Folder01Icon } from '@hugeicons/core-free-icons'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { ShareButton } from '@/components/detail/public-actions'
import {
	CollectionFormDialog,
	VISIBILITY_OPTIONS,
} from '@/components/social/collection-form-dialog'
import { PagedList } from '@/components/social/paged-list'
import {
	FollowButton,
	type ListingTargetType,
	SaveButton,
} from '@/components/social/social-buttons'
import { TargetRow } from '@/components/social/target-row'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { userFacingError } from '@/lib/user-facing-error'

const PAGE_SIZE = 24

function CollectionItems({
	collectionId,
	isOwner,
}: {
	collectionId: Id<'collections'>
	isOwner: boolean
}) {
	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.social.collections.listItems,
		{ collectionId },
		{ initialNumItems: PAGE_SIZE },
	)
	const removeItem = useMutation(api.functions.social.collections.removeItem)
	const items = results.filter((item) => item !== null)

	return (
		<PagedList
			empty={{
				icon: Folder01Icon,
				title: 'Nothing here yet',
				description: isOwner
					? 'Use the folder button on any add-on, resource pack, plugin or server to add it.'
					: 'This collection is empty.',
			}}
			items={items}
			loadMore={loadMore}
			pageSize={PAGE_SIZE}
			renderItem={(item) => {
				const targetType = item.targetType as ListingTargetType
				return (
					<TargetRow
						actions={
							isOwner ? (
								<Button
									onClick={async () => {
										try {
											await removeItem({
												collectionId,
												targetType,
												targetId: item.targetId,
											})
										} catch (error) {
											toast.error(
												userFacingError(
													error,
													'Could not remove the item',
												),
											)
										}
									}}
									size="sm"
									type="button"
									variant="outline"
								>
									Remove
								</Button>
							) : (
								<SaveButton
									iconOnly
									targetId={item.targetId}
									targetType={targetType}
								/>
							)
						}
						detail={item.note}
						key={`${item.targetType}:${item.targetId}`}
						summary={item}
					/>
				)
			}}
			status={status}
		/>
	)
}

/** A collection page (/collections/[ref]). */
export function CollectionView({ reference }: { reference: string }) {
	const collection = useQuery(api.functions.social.collections.getByRef, {
		ref: reference,
	})
	const [editing, setEditing] = useState(false)

	if (collection === undefined) {
		return (
			<main className="container mx-auto flex flex-col gap-4 px-4 py-10 md:px-6">
				<Skeleton className="h-12 w-80 max-w-full" />
				<Skeleton className="h-64" />
			</main>
		)
	}
	if (collection === null) {
		return (
			<main className="container mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
				<h1 className="font-bold text-3xl">Collection not found</h1>
				<p className="text-muted-foreground">
					It may have been deleted or made private.
				</p>
				<Link className="text-ember-text underline" href="/collections">
					Browse collections
				</Link>
			</main>
		)
	}
	const visibility = VISIBILITY_OPTIONS.find(
		(option) => option.value === collection.visibility,
	)

	return (
		<main className="flex flex-1 flex-col">
			<header className="border-b bg-surface-sunken">
				<div className="container mx-auto flex flex-wrap items-end justify-between gap-4 px-4 pt-10 pb-8 md:px-6">
					<div className="flex min-w-0 flex-col gap-2.5">
						<p className="eyebrow">Collection</p>
						<h1 className="text-balance font-bold text-[clamp(2rem,4vw,3rem)] leading-none">
							{collection.name}
						</h1>
						{collection.description ? (
							<p className="max-w-2xl text-[17px] text-muted-foreground">
								{collection.description}
							</p>
						) : null}
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground text-sm">
							{collection.owner ? (
								<Link
									className="inline-flex items-center gap-2 font-semibold text-ember-text hover:text-foreground"
									href={
										`/user/${encodeURIComponent(collection.owner.username)}` as Route
									}
								>
									<UserAvatarImage
										avatarClassName="size-5"
										image={collection.owner.imageUrl}
										size={20}
										username={collection.owner.name}
									/>
									{collection.owner.name}
								</Link>
							) : null}
							<span>
								{collection.itemCount.toLocaleString()} items
							</span>
							{collection.visibility === 'public' ? null : (
								<Badge variant="outline">
									{visibility?.label}
								</Badge>
							)}
						</div>
					</div>
					<div className="flex gap-2">
						{collection.isOwner ? (
							<Button
								onClick={() => setEditing(true)}
								size="sm"
								type="button"
								variant="outline"
							>
								Edit
							</Button>
						) : null}
						{!collection.isOwner &&
						collection.visibility !== 'private' ? (
							<FollowButton
								size="sm"
								targetId={collection._id}
								targetType="collection"
							/>
						) : null}
						{collection.visibility === 'private' ? null : (
							<ShareButton size="sm" title={collection.name} />
						)}
					</div>
				</div>
			</header>
			<div className="container mx-auto w-full max-w-4xl px-4 pt-7 pb-18 md:px-6">
				<CollectionItems
					collectionId={collection._id}
					isOwner={collection.isOwner}
				/>
			</div>
			{collection.isOwner ? (
				<CollectionFormDialog
					collection={collection}
					onOpenChange={setEditing}
					open={editing}
				/>
			) : null}
		</main>
	)
}
