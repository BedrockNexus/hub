import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface ReviewsSectionProps {
	reviewCount?: number | null
	entityLabel: string
	reviewStats: React.ReactNode
	reviewForm: React.ReactNode
	reviewList: React.ReactNode
}

export function ReviewsSection({
	reviewCount,
	entityLabel,
	reviewStats,
	reviewForm,
	reviewList,
}: ReviewsSectionProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					Reviews
					{reviewCount ? (
						<Badge
							className="ml-2 px-1.5 py-0 text-xs"
							variant="secondary"
						>
							{reviewCount}
						</Badge>
					) : null}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{reviewStats}
				{reviewForm}

				{reviewCount ? (
					<Separator />
				) : (
					<p className="py-4 text-center text-muted-foreground">
						No reviews yet. Be the first to review this{' '}
						{entityLabel}!
					</p>
				)}

				{reviewList}
			</CardContent>
		</Card>
	)
}
