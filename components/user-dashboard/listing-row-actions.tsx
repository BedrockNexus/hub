'use client'
import {
	CheckmarkCircle01Icon,
	Copy01Icon,
	Delete02Icon,
	GithubIcon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	DeleteListingDialog,
	type ListingDeletion,
} from './edit-sidebar/delete-listing-dialog'
export function ListingRowActions({
	id,
	name,
	editHref,
	reviewHref,
	publicHref,
	repositoryHref,
	deletion,
}: {
	id: string
	name: string
	editHref?: string | null
	reviewHref?: string | null
	publicHref?: string | null
	repositoryHref?: string
	deletion?: ListingDeletion
}) {
	const [deleting, setDeleting] = useState(false)
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={<Button size="icon-sm" variant="ghost" />}
				>
					<HugeiconsIcon icon={MoreHorizontalIcon} />
					<span className="sr-only">Open menu for {name}</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuGroup>
						{editHref ? (
							<DropdownMenuItem
								nativeButton={false}
								render={<Link href={editHref as Route} />}
							>
								<HugeiconsIcon icon={PencilEdit01Icon} />
								Edit listing
							</DropdownMenuItem>
						) : null}
						{reviewHref ? (
							<DropdownMenuItem
								nativeButton={false}
								render={<Link href={reviewHref as Route} />}
							>
								<HugeiconsIcon icon={CheckmarkCircle01Icon} />
								Review submission
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(id)
									toast.success('Listing ID copied')
								} catch {
									toast.error('Failed to copy listing ID')
								}
							}}
						>
							<HugeiconsIcon icon={Copy01Icon} />
							Copy listing ID
						</DropdownMenuItem>
						{publicHref ? (
							<DropdownMenuItem
								nativeButton={false}
								render={<Link href={publicHref as Route} />}
							>
								<HugeiconsIcon icon={ViewIcon} />
								View public page
							</DropdownMenuItem>
						) : null}
						{repositoryHref ? (
							<DropdownMenuItem
								nativeButton={false}
								render={
									<a
										href={repositoryHref}
										rel="noreferrer"
										target="_blank"
									/>
								}
							>
								<HugeiconsIcon icon={GithubIcon} />
								Open repository
							</DropdownMenuItem>
						) : null}
						{deletion ? (
							<DropdownMenuItem
								onClick={() => setDeleting(true)}
								variant="destructive"
							>
								<HugeiconsIcon icon={Delete02Icon} />
								Delete listing
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			{deletion ? (
				<DeleteListingDialog
					deletion={deletion}
					onOpenChange={setDeleting}
					open={deleting}
				/>
			) : null}
		</>
	)
}
