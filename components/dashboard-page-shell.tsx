import type { ReactNode } from 'react'
import { WorkspacePageHeader } from '@/components/workspace-page-header'
import { cn } from '@/lib/utils'

interface DashboardPageShellProps {
	actions?: ReactNode
	children: ReactNode
	className?: string
	description: string
	eyebrow?: string
	title: string
}

export function DashboardPageShell({
	actions,
	children,
	className,
	description,
	eyebrow,
	title,
}: DashboardPageShellProps) {
	return (
		<div className={cn('flex min-w-0 flex-col gap-6', className)}>
			<WorkspacePageHeader
				actions={actions}
				description={description}
				eyebrow={eyebrow}
				title={title}
			/>
			<div className="flex min-w-0 flex-col gap-6">{children}</div>
		</div>
	)
}
