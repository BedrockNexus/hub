'use client'

import { StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Rating, RatingItem } from '@/components/dice-ui/rating'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ExistingReviewValue {
	rating: number
	content?: string | null
}

interface ReviewFormBaseProps {
	itemName: string
	isAuthenticated: boolean
	existingReview: ExistingReviewValue | null | undefined
	onSubmit: (data: { rating: number; content?: string }) => Promise<void>
	trigger?: React.ReactElement
	ratingItemClassName?: string
	filledStarClassName?: string
}

export function ReviewFormBase({
	itemName,
	isAuthenticated,
	existingReview,
	onSubmit,
	trigger,
	ratingItemClassName = 'text-primary',
	filledStarClassName = 'fill-primary',
}: ReviewFormBaseProps) {
	const [open, setOpen] = useState(false)
	const [rating, setRating] = useState(0)
	const [content, setContent] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleOpenChange = (newOpen: boolean) => {
		if (newOpen && existingReview) {
			setRating(existingReview.rating)
			setContent(existingReview.content ?? '')
		} else if (!(newOpen || existingReview)) {
			setRating(0)
			setContent('')
		}
		setOpen(newOpen)
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (rating === 0) {
			toast.error('Please select a rating')
			return
		}

		setIsSubmitting(true)
		try {
			await onSubmit({
				rating,
				content: content.trim() || undefined,
			})
			toast.success(
				existingReview
					? 'Review updated successfully!'
					: 'Review submitted successfully!',
			)
			setOpen(false)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to submit review',
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const isEditing = !!existingReview
	let submitLabel = 'Submit Review'
	if (isEditing) {
		submitLabel = 'Update Review'
	}
	if (isSubmitting) {
		submitLabel = 'Submitting...'
	}
	const starKeys = [1, 2, 3, 4, 5] as const
	const buttonLabel = isEditing ? 'Edit Your Review' : 'Write a Review'

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			{trigger ? (
				<DialogTrigger disabled={!isAuthenticated} render={trigger} />
			) : (
				<DialogTrigger
					disabled={!isAuthenticated}
					render={<Button className="w-full" />}
				>
					<HugeiconsIcon className="size-4" icon={StarIcon} />
					{isAuthenticated ? buttonLabel : 'Sign in to Review'}
				</DialogTrigger>
			)}
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? 'Edit Your Review' : 'Write a Review'}
					</DialogTitle>
					<DialogDescription>
						Share your experience with {itemName}
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label>Rating</Label>
						<div className="flex items-center gap-2">
							<Rating
								max={5}
								onValueChange={setRating}
								size="lg"
								value={rating}
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
							<span className="text-muted-foreground text-sm">
								{rating > 0
									? `${rating} star${rating === 1 ? '' : 's'}`
									: 'Select a rating'}
							</span>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="content">Review (optional)</Label>
						<Textarea
							id="content"
							maxLength={2000}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Tell others about your experience..."
							rows={4}
							value={content}
						/>
						<p className="text-right text-muted-foreground text-xs">
							{content.length}/2000
						</p>
					</div>

					<DialogFooter>
						<Button
							onClick={() => setOpen(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={isSubmitting || rating === 0}
							type="submit"
						>
							{submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
