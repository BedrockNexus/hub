'use client'

import { useMutation, useQuery } from 'convex/react'
import { ReviewFormBase } from '@/components/reviews/review-form-base'
import { ReviewListBase } from '@/components/reviews/review-list-base'
import { ReviewStatsBase } from '@/components/reviews/review-stats-base'
import { ReviewsSection } from '@/components/reviews/reviews-section'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { authClient } from '@/lib/auth-client'

export function PluginReviews({
	pluginId,
	pluginName,
	reviewCount,
}: {
	pluginId: Id<'plugins'>
	pluginName: string
	reviewCount?: number | null
}) {
	const { data: session } = authClient.useSession()
	const isAuthenticated = !!session?.user

	const userReview = useQuery(
		api.functions.plugins.reviews.getUserReview,
		isAuthenticated ? { pluginId } : 'skip',
	)
	const reviews = useQuery(api.functions.plugins.reviews.list, {
		pluginId,
		limit: 20,
		sortBy: 'recent',
	})
	const stats = useQuery(api.functions.plugins.reviews.getStats, {
		pluginId,
	})
	const upsertReview = useMutation(api.functions.plugins.reviews.upsert)
	const removeReview = useMutation(api.functions.plugins.reviews.remove)

	return (
		<ReviewsSection
			entityLabel="plugin"
			reviewCount={reviewCount}
			reviewForm={
				<ReviewFormBase
					existingReview={userReview}
					filledStarClassName="fill-primary"
					isAuthenticated={isAuthenticated}
					itemName={pluginName}
					onSubmit={async ({ rating, content }) => {
						await upsertReview({ pluginId, rating, content })
					}}
					ratingItemClassName="text-primary"
				/>
			}
			reviewList={
				<ReviewListBase
					onDelete={async (id: Id<'pluginReviews'>) => {
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
