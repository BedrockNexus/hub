'use client'

import { usePathname } from 'next/navigation'
import { useAccountLinks } from '@/components/layout/account-links'
import { WorkspaceHeader } from '@/components/workspace-header'
import { isFocusedDashboardPath } from '@/lib/dashboard-focus'

export function DashboardHeader() {
	const links = useAccountLinks()
	const pathname = usePathname()
	return (
		<WorkspaceHeader
			label="Creator dashboard"
			links={links}
			showSidebarTrigger={!isFocusedDashboardPath(pathname)}
		/>
	)
}
