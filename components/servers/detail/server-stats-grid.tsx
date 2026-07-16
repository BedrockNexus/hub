import {
	Clock02Icon,
	StarIcon,
	UserMultiple02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
	Stat,
	StatIndicator,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'

type ServerStatus =
	| {
			online?: boolean
			playerCount?: number
			maxPlayers?: number
			uptimePercent?: number
	  }
	| null
	| undefined

export function ServerStatsGrid(props: {
	status: ServerStatus
	averageRating?: number | null
}) {
	const playerCount = props.status?.playerCount ?? 0
	const maxPlayers = props.status?.maxPlayers ?? 0
	const uptimePercent = props.status?.uptimePercent ?? 0

	return (
		<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
			<Stat className="p-3">
				<StatLabel>Players</StatLabel>
				<StatValue className="text-lg">
					{playerCount}/{maxPlayers}
				</StatValue>
				<StatIndicator color="info" variant="icon">
					<HugeiconsIcon
						className="size-3.5"
						icon={UserMultiple02Icon}
					/>
				</StatIndicator>
			</Stat>

			<Stat className="p-3">
				<StatLabel>Uptime</StatLabel>
				<StatValue className="text-lg">
					{uptimePercent.toFixed(0)}%
				</StatValue>
				<StatIndicator color="success" variant="icon">
					<HugeiconsIcon className="size-3.5" icon={Clock02Icon} />
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
