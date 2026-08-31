import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WorkspacePageHeaderProps {
	actions?: ReactNode
	className?: string
	description?: string
	eyebrow?: string
	title: string
}

export function WorkspacePageHeader({
	actions,
	className,
	description,
	eyebrow,
	title,
}: WorkspacePageHeaderProps) {
	return (
		<header
			className={cn(
				'flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between',
				className,
			)}
		>
			<div className="min-w-0">
				{eyebrow ? (
					<p className="mb-1.5 font-medium text-muted-foreground text-xs uppercase">
						{eyebrow}
					</p>
				) : null}
				<h1 className="text-balance font-bold text-2xl md:text-3xl">
					{title}
				</h1>
				{description ? (
					<p className="mt-1.5 max-w-3xl text-muted-foreground text-sm leading-6">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
			) : null}
		</header>
	)
}
