import type { ReactNode } from 'react'
import { WorkspacePageHeader } from '@/components/workspace-page-header'

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
		<WorkspacePageHeader
			actions={actions}
			className={className}
			description={description}
			title={title}
		/>
	)
}
