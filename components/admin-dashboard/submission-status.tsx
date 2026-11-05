import { Badge } from '@/components/ui/badge'
export function SubmissionStatusBadge({
	status,
}: {
	status?: 'pending' | 'changes_requested' | 'approved' | 'rejected'
}) {
	if (!status) {
		return null
	}
	const labels = {
		pending: 'Awaiting review',
		changes_requested: 'Changes requested',
		approved: 'Approved',
		rejected: 'Rejected',
	}
	return (
		<Badge variant={status === 'rejected' ? 'destructive' : 'outline'}>
			{labels[status]}
		</Badge>
	)
}
