'use client'

import { useAccountLinks } from '@/components/layout/account-links'
import { WorkspaceHeader } from '@/components/workspace-header'

export function ModerationHeader() {
	const links = useAccountLinks()
	return <WorkspaceHeader label="Moderation" links={links} />
}
