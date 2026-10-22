'use client'

import { useAccountLinks } from '@/components/layout/account-links'
import { WorkspaceHeader } from '@/components/workspace-header'

export function DashboardHeader() {
	const links = useAccountLinks()
	return <WorkspaceHeader label="Creator dashboard" links={links} />
}
