'use client'

import { StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Rating, RatingItem } from '@/components/dice-ui/rating'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

interface ReviewStatsShape {
	totalReviews: number
	averageRating: number
	distribution: Record<number, number>
}

interface ReviewStatsBaseProps {
	stats: ReviewStatsShape | null | undefined
	ratingItemClassName?: string
	filledStarClassName?: string
	distributionStarClassName?: string
}

export function ReviewStatsBase({
	stats,
	ratingItemClassName,
	filledStarClassName = 'fill-primary',
	distributionStarClassName = 'size-3 fill-primary text-primary',
}: ReviewStatsBaseProps) {
	const starKeys = [1, 2, 3, 4, 5] as const

	if (stats === undefined) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-4">
					<Skeleton className="h-16 w-20" />
					<div className="space-y-2">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-24" />
					</div>
				</div>
			</div>
		)
	}

	if (stats === null || stats.totalReviews === 0) {
		return null
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-4">
				<div className="text-center">
					<div className="font-bold text-4xl">
						{stats.averageRating.toFixed(1)}
					</div>
					<Rating
						max={5}
						readOnly
						size="sm"
						value={stats.averageRating}
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
					<div className="text-muted-foreground text-sm">
						{stats.totalReviews} review
						{stats.totalReviews === 1 ? '' : 's'}
					</div>
				</div>

				<div className="flex-1 space-y-1">
					{[5, 4, 3, 2, 1].map((rating) => {
						const count = stats.distribution[rating] ?? 0
						const percentage =
							stats.totalReviews > 0
								? (count / stats.totalReviews) * 100
								: 0

						return (
							<div
								className="flex items-center gap-2"
								key={rating}
							>
								<span className="w-3 text-sm">{rating}</span>
								<HugeiconsIcon
									className={distributionStarClassName}
									icon={StarIcon}
								/>
								<Progress
									className="h-2 flex-1"
									value={percentage}
								/>
								<span className="w-8 text-right text-muted-foreground text-xs">
									{count}
								</span>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
