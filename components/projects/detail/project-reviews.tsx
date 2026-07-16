'use client'

import { useMutation, useQuery } from 'convex/react'
import { ReviewFormBase } from '@/components/reviews/review-form-base'
import { ReviewListBase } from '@/components/reviews/review-list-base'
import { ReviewStatsBase } from '@/components/reviews/review-stats-base'
import { ReviewsSection } from '@/components/reviews/reviews-section'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { authClient } from '@/lib/auth-client'

interface ProjectReviewsProps {
	projectId: Id<'projects'>
	projectName: string
	reviewCount?: number | null
}

export function ProjectReviews({
	projectId,
	projectName,
	reviewCount,
}: ProjectReviewsProps) {
	const { data: session } = authClient.useSession()
	const isAuthenticated = !!session?.user

	const userReview = useQuery(
		api.functions.projects.reviews.getUserReview,
		isAuthenticated ? { projectId } : 'skip',
	)
	const reviews = useQuery(api.functions.projects.reviews.list, {
		projectId,
		limit: 20,
		sortBy: 'recent',
	})
	const stats = useQuery(api.functions.projects.reviews.getStats, {
		projectId,
	})
	const upsertReview = useMutation(api.functions.projects.reviews.upsert)
	const removeReview = useMutation(api.functions.projects.reviews.remove)

	return (
		<ReviewsSection
			entityLabel="project"
			reviewCount={reviewCount}
			reviewForm={
				<ReviewFormBase
					existingReview={userReview}
					filledStarClassName="fill-primary"
					isAuthenticated={isAuthenticated}
					itemName={projectName}
					onSubmit={async ({ rating, content }) => {
						await upsertReview({
							projectId,
							rating,
							content,
						})
					}}
					ratingItemClassName="text-primary"
				/>
			}
			reviewList={
				<ReviewListBase
					onDelete={async (id: Id<'projectReviews'>) => {
						await removeReview({ id })
					}}
					profileHref={(username) => `/user/${username}`}
					reviews={reviews}
					userReviewId={userReview?._id ?? null}
				/>
			}
			reviewStats={
				<ReviewStatsBase
					distributionStarClassName="size-3 fill-primary text-primary"
					filledStarClassName="fill-primary"
					ratingItemClassName="text-primary"
					stats={stats}
				/>
			}
		/>
	)
}
