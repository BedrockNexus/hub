'use client'

import { usePathname } from 'next/navigation'
import { useAccountLinks } from '@/components/layout/account-links'
import { WorkspaceHeader } from '@/components/workspace-header'
import { adminReviewTarget } from '@/lib/admin-review-navigation'

export function ModerationHeader() {
	const links = useAccountLinks()
	const pathname = usePathname()
	return (
		<WorkspaceHeader
			label="Moderation"
			links={links}
			showSidebarTrigger={!adminReviewTarget(pathname)}
		/>
	)
}
