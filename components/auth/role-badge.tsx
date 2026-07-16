import { Crown02Icon, Shield01Icon, UserIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ROLE_CONFIG: Record<
	string,
	{
		label: string
		icon: typeof UserIcon
		className: string
	}
> = {
	admin: {
		label: 'Admin',
		icon: Crown02Icon,
		className:
			'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
	},
	verified: {
		label: 'Verified',
		icon: Shield01Icon,
		className:
			'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
	},
	creator: {
		label: 'Creator',
		icon: UserIcon,
		className:
			'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
	},
}

interface RoleBadgeProps {
	role?: string
	className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
	if (!role) {
		return null
	}

	const config = ROLE_CONFIG[role]
	if (!config) {
		return null
	}

	return (
		<Badge
			className={cn('gap-1 border', config.className, className)}
			variant="outline"
		>
			<HugeiconsIcon className="size-3" icon={config.icon} />
			{config.label}
		</Badge>
	)
}

interface RoleBadgeListProps {
	role?: string
	className?: string
}

/**
 * Renders all applicable badges for a user.
 * Currently supports role-based badges; extensible for future badge types.
 */
export function RoleBadgeList({ role, className }: RoleBadgeListProps) {
	if (!role) {
		return null
	}

	return (
		<div className={cn('flex flex-wrap gap-1.5', className)}>
			<RoleBadge role={role} />
		</div>
	)
}
