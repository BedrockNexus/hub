import { Download01Icon, StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
	Stat,
	StatIndicator,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'

export function ProjectStatsGrid(props: {
	totalDownloads?: number | null
	averageRating?: number | null
}) {
	return (
		<div className="mb-6 grid grid-cols-2 gap-3">
			<Stat className="p-3">
				<StatLabel>Downloads</StatLabel>
				<StatValue className="text-lg">
					{(props.totalDownloads ?? 0).toLocaleString()}
				</StatValue>
				<StatIndicator color="info" variant="icon">
					<HugeiconsIcon className="size-3.5" icon={Download01Icon} />
				</StatIndicator>
			</Stat>

			<Stat className="p-3">
				<StatLabel>Rating</StatLabel>
				<StatValue className="text-lg">
					{props.averageRating
						? props.averageRating.toFixed(1)
						: 'N/A'}
				</StatValue>
				<StatIndicator color="warning" variant="icon">
					<HugeiconsIcon className="size-3.5" icon={StarIcon} />
				</StatIndicator>
			</Stat>
		</div>
	)
}
