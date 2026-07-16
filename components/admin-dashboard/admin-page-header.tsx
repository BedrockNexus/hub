import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AdminPageHeaderProps {
	actions?: ReactNode
	className?: string
	description?: string
	title: string
}

export function AdminPageHeader({
	actions,
	className,
	description,
	title,
}: AdminPageHeaderProps) {
	return (
		<div
			className={cn(
				'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
				className,
			)}
		>
			<div className="min-w-0 space-y-1">
				<h1 className="font-semibold text-2xl tracking-tight">
					{title}
				</h1>
				{description ? (
					<p className="max-w-3xl text-muted-foreground text-sm">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
			) : null}
		</div>
	)
}
