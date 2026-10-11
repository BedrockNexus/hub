import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function DashboardPageShell({
	eyebrow,
	title,
	description,
	actions,
	children,
	className,
}: {
	eyebrow?: string
	title: string
	description: string
	actions?: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<div className={cn('flex min-w-0 flex-col gap-6', className)}>
			<header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					{eyebrow && (
						<p className="mb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-[0.12em]">
							{eyebrow}
						</p>
					)}
					<h1 className="text-balance font-bold text-2xl tracking-tight md:text-3xl">
						{title}
					</h1>
					<p className="mt-1.5 max-w-3xl text-muted-foreground text-sm leading-6">
						{description}
					</p>
				</div>
				{actions && (
					<div className="flex shrink-0 flex-wrap gap-2">
						{actions}
					</div>
				)}
			</header>
			<div className="flex min-w-0 flex-col gap-6">{children}</div>
		</div>
	)
}
