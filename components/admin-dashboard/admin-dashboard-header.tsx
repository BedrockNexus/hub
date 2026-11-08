'use client'

import { useAccountLinks } from '@/components/layout/account-links'
import { WorkspaceHeader } from '@/components/workspace-header'

export function AdminDashboardHeader() {
	const links = useAccountLinks()
	return <WorkspaceHeader label="Administration" links={links} />
}
