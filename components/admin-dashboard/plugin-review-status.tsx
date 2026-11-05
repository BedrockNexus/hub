import { Badge } from '@/components/ui/badge'
import type { Doc } from '@/convex/_generated/dataModel'

export const reviewStatusLabels = {
	notSubmitted: 'Not submitted',
	preparing: 'Preparing',
	preparationFailed: 'Preparation failed',
	inReview: 'Awaiting review',
	changesRequested: 'Changes requested',
	rejected: 'Rejected',
	publishing: 'Publishing',
	published: 'Approved',
} satisfies Record<Doc<'pluginReleases'>['status'] | 'notSubmitted', string>

export function PluginReviewStatusBadge({
	status,
}: {
	status: keyof typeof reviewStatusLabels
}) {
	const needsAttention =
		status === 'rejected' ||
		status === 'changesRequested' ||
		status === 'preparationFailed'
	return (
		<Badge variant={needsAttention ? 'destructive' : 'outline'}>
			{reviewStatusLabels[status]}
		</Badge>
	)
}
