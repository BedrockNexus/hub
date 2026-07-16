'use client'

import {
	Status,
	StatusIndicator,
	StatusLabel,
} from '@/components/dice-ui/status'
import { Badge } from '@/components/ui/badge'

type ServerCategory = { _id: string; name: string } | null

export function ServerStatsRow(props: {
	isOnline?: boolean
	categories: ServerCategory[]
}) {
	let statusVariant: 'default' | 'error' | 'success' = 'default'
	let statusLabel = 'Unknown'

	if (props.isOnline === false) {
		statusVariant = 'error'
		statusLabel = 'Offline'
	} else if (props.isOnline) {
		statusVariant = 'success'
		statusLabel = 'Online'
	}

	return (
		<div className="mb-6 flex flex-wrap items-center gap-3 text-sm md:gap-4">
			<Status variant={statusVariant}>
				<StatusIndicator />
				<StatusLabel>{statusLabel}</StatusLabel>
			</Status>

			{props.categories.filter(Boolean).map((category) => (
				<Badge key={category?._id} variant="outline">
					{category?.name}
				</Badge>
			))}
		</div>
	)
}
