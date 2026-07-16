'use client'

import {
	Delete02Icon,
	MoreHorizontalIcon,
	StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { Rating, RatingItem } from '@/components/dice-ui/rating'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

interface ReviewUser {
	name?: string
	username?: string
	displayUsername?: string
	image?: string
}

interface ReviewListItem<TReviewId extends string = string> {
	_id: TReviewId
	rating: number
	content?: string | null
	createdAt: number
	updatedAt?: number
	user?: ReviewUser | null
}

interface ReviewListBaseProps<TReviewId extends string> {
	reviews: ReviewListItem<TReviewId>[] | undefined
	userReviewId?: TReviewId | null
	onDelete: (id: TReviewId) => Promise<void>
	profileHref: (username: string) => string
	ratingItemClassName?: string
	filledStarClassName?: string
	dropdownAlign?: 'start' | 'center' | 'end'
}

export function ReviewListBase<TReviewId extends string>({
	reviews,
	userReviewId,
	onDelete,
	profileHref,
	ratingItemClassName,
	filledStarClassName = 'fill-primary',
	dropdownAlign,
}: ReviewListBaseProps<TReviewId>) {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [reviewToDelete, setReviewToDelete] = useState<TReviewId | null>(null)
	const starKeys = [1, 2, 3, 4, 5] as const

	if (reviews === undefined) {
		return (
			<div className="space-y-4">
				{[1, 2, 3].map((i) => (
					<div className="space-y-2" key={i}>
						<div className="flex items-center gap-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-32" />
						</div>
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-16 w-full" />
					</div>
				))}
			</div>
		)
	}

	if (reviews.length === 0) {
		return null
	}

	const handleDeleteReview = async () => {
		if (!reviewToDelete) {
			return
		}

		try {
			await onDelete(reviewToDelete)
			toast.success('Review deleted')
			setDeleteDialogOpen(false)
			setReviewToDelete(null)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to delete review',
			)
		}
	}

	const confirmDelete = (reviewId: TReviewId) => {
		setReviewToDelete(reviewId)
		setDeleteDialogOpen(true)
	}

	return (
		<>
			<div className="space-y-4">
				{reviews.map((review) => {
					const isOwnReview = userReviewId === review._id
					const profileUsername = review.user?.username
					const displayName =
						review.user?.displayUsername ||
						review.user?.username ||
						review.user?.name ||
						'Anonymous'

					return (
						<div
							className="space-y-3 rounded-lg border p-4"
							key={review._id}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<UserAvatarImage
										avatarClassName="size-8"
										image={review.user?.image}
										size={32}
										username={displayName}
									/>
									<div className="flex flex-col">
										{profileUsername ? (
											<Link
												className="font-medium text-sm hover:underline"
												href={profileHref(
													encodeURIComponent(
														profileUsername,
													),
												)}
											>
												{displayName}
											</Link>
										) : (
											<span className="font-medium text-sm">
												{displayName}
											</span>
										)}
										<div className="flex items-center gap-2">
											<span className="text-muted-foreground text-xs">
												{formatDistanceToNow(
													new Date(review.createdAt),
													{ addSuffix: true },
												)}
											</span>
											{review.updatedAt && (
												<span className="text-muted-foreground text-xs">
													(edited)
												</span>
											)}
										</div>
									</div>
								</div>

								<div className="flex items-center gap-2">
									<Rating
										max={5}
										readOnly
										size="sm"
										value={review.rating}
									>
										{starKeys.map((star) => (
											<RatingItem
												className={ratingItemClassName}
												key={star}
											>
												{(state) => (
													<HugeiconsIcon
														className={
															state === 'full' ||
															state === 'partial'
																? filledStarClassName
																: 'fill-transparent'
														}
														icon={StarIcon}
													/>
												)}
											</RatingItem>
										))}
									</Rating>

									{isOwnReview && (
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button
														className="size-8"
														size="icon"
														variant="ghost"
													/>
												}
											>
												<HugeiconsIcon
													className="size-4"
													icon={MoreHorizontalIcon}
												/>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align={dropdownAlign}
											>
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() =>
														confirmDelete(
															review._id,
														)
													}
												>
													<HugeiconsIcon
														className="size-4"
														icon={Delete02Icon}
													/>
													Delete Review
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</div>
							</div>

							{review.content && (
								<p className="whitespace-pre-wrap text-muted-foreground text-sm">
									{review.content}
								</p>
							)}
						</div>
					)
				})}
			</div>

			<AlertDialog
				onOpenChange={setDeleteDialogOpen}
				open={deleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Review</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete your review? This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleDeleteReview}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
