import {
	Status,
	StatusIndicator,
	StatusLabel,
} from '@/components/dice-ui/status'

export type LifecycleStatus = 'draft' | 'published' | 'under_review'

export type ModerationStatus = 'approved' | 'pending' | 'flagged' | 'rejected'

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
	draft: 'Draft',
	published: 'Published',
	under_review: 'Under Review',
}

export const MODERATION_LABELS: Record<ModerationStatus, string> = {
	approved: 'Approved',
	pending: 'Pending',
	flagged: 'Flagged',
	rejected: 'Rejected',
}

const LIFECYCLE_VARIANTS: Record<
	LifecycleStatus,
	'success' | 'warning' | 'error' | 'default'
> = {
	published: 'success',
	under_review: 'warning',
	draft: 'default',
}

const MODERATION_VARIANTS: Record<
	ModerationStatus,
	'success' | 'warning' | 'error' | 'info'
> = {
	approved: 'success',
	pending: 'warning',
	flagged: 'info',
	rejected: 'error',
}

export function LifecycleStatusBadge({ status }: { status?: LifecycleStatus }) {
	if (!status) {
		return (
			<Status variant="default">
				<StatusLabel>Unknown</StatusLabel>
			</Status>
		)
	}

	return (
		<Status variant={LIFECYCLE_VARIANTS[status]}>
			{status === 'published' ? <StatusIndicator /> : null}
			<StatusLabel>{LIFECYCLE_LABELS[status]}</StatusLabel>
		</Status>
	)
}

export function ModerationStatusBadge({
	status,
}: {
	status?: ModerationStatus
}) {
	if (!status) {
		return (
			<Status variant="default">
				<StatusLabel>Unreviewed</StatusLabel>
			</Status>
		)
	}

	return (
		<Status variant={MODERATION_VARIANTS[status]}>
			<StatusLabel>{MODERATION_LABELS[status]}</StatusLabel>
		</Status>
	)
}
