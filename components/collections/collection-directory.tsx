'use client'

import { Folder01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { usePaginatedQuery } from 'convex/react'
import type { Route } from 'next'
import Link from 'next/link'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'

const PAGE_SIZE = 24

/** Public collections, most followed first (/collections). */
export function CollectionDirectory() {
	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.social.collections.listPopular,
		{},
		{ initialNumItems: PAGE_SIZE },
	)
	const collections = results.filter((item) => item !== null)

	if (status === 'LoadingFirstPage') {
		return (
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				<Skeleton className="h-32" />
				<Skeleton className="h-32" />
				<Skeleton className="h-32" />
			</div>
		)
	}
	if (collections.length === 0 && status === 'Exhausted') {
		return (
			<p className="rounded-md border border-dashed px-6 py-14 text-center text-muted-foreground">
				No public collections yet. Make one from your dashboard.
			</p>
		)
	}
	return (
		<div className="flex flex-col gap-6">
			<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{collections.map((collection) => (
					<li key={collection._id}>
						<Link
							className="flex h-full flex-col gap-3 rounded-md border bg-card p-4 transition-colors hover:border-foreground/30"
							href={
								`/collections/${collection.publicId}` as Route
							}
						>
							<span className="flex items-center gap-3">
								<span className="grid size-10 shrink-0 place-items-center rounded-md bg-stone text-white">
									<HugeiconsIcon
										aria-hidden
										className="size-5"
										icon={Folder01Icon}
									/>
								</span>
								<span className="min-w-0">
									<span className="block truncate font-semibold">
										{collection.name}
									</span>
									<span className="block text-muted-foreground text-sm">
										{collection.itemCount.toLocaleString()}{' '}
										items
										{collection.followerCount > 0
											? ` · ${collection.followerCount.toLocaleString()} followers`
											: ''}
									</span>
								</span>
							</span>
							{collection.description ? (
								<span className="line-clamp-2 text-muted-foreground text-sm">
									{collection.description}
								</span>
							) : null}
							<span className="mt-auto flex items-center gap-2 text-muted-foreground text-sm">
								<UserAvatarImage
									avatarClassName="size-5"
									image={collection.owner.imageUrl}
									size={20}
									username={collection.owner.name}
								/>
								{collection.owner.name}
							</span>
						</Link>
					</li>
				))}
			</ul>
			{status === 'CanLoadMore' || status === 'LoadingMore' ? (
				<div className="flex justify-center">
					<Button
						disabled={status === 'LoadingMore'}
						onClick={() => loadMore(PAGE_SIZE)}
						type="button"
						variant="outline"
					>
						Load more
					</Button>
				</div>
			) : null}
		</div>
	)
}
