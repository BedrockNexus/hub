'use client'

import { useMutation, useQuery } from 'convex/react'
import { ReviewFormBase } from '@/components/reviews/review-form-base'
import { ReviewListBase } from '@/components/reviews/review-list-base'
import { ReviewStatsBase } from '@/components/reviews/review-stats-base'
import { ReviewsSection } from '@/components/reviews/reviews-section'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { authClient } from '@/lib/auth-client'

interface ServerReviewsProps {
	serverId: Id<'servers'>
	serverName: string
	reviewCount?: number | null
}

export function ServerReviews({
	serverId,
	serverName,
	reviewCount,
}: ServerReviewsProps) {
	const { data: session } = authClient.useSession()
	const isAuthenticated = !!session?.user

	const userReview = useQuery(
		api.functions.servers.reviews.getUserReview,
		isAuthenticated ? { serverId } : 'skip',
	)
	const reviews = useQuery(api.functions.servers.reviews.list, {
		serverId,
		limit: 20,
		sortBy: 'recent',
	})
	const stats = useQuery(api.functions.servers.reviews.getStats, {
		serverId,
	})
	const upsertReview = useMutation(api.functions.servers.reviews.upsert)
	const removeReview = useMutation(api.functions.servers.reviews.remove)

	return (
		<ReviewsSection
			entityLabel="server"
			reviewCount={reviewCount}
			reviewForm={
				<ReviewFormBase
					existingReview={userReview}
					isAuthenticated={isAuthenticated}
					itemName={serverName}
					onSubmit={async ({ rating, content }) => {
						await upsertReview({
							serverId,
							rating,
							content,
						})
					}}
				/>
			}
			reviewList={
				<ReviewListBase
					onDelete={async (id: Id<'serverReviews'>) => {
						await removeReview({ id })
					}}
					profileHref={(username) => `/user/${username}`}
					reviews={reviews}
					userReviewId={userReview?._id ?? null}
				/>
			}
			reviewStats={<ReviewStatsBase stats={stats} />}
		/>
	)
}
