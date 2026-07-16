'use client'

import { usePathname } from 'next/navigation'
import type * as React from 'react'
import type { Sidebar } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/user-dashboard/app-sidebar'
import { OrgSidebar } from '@/components/user-dashboard/organizations/org-sidebar'
import { ProjectEditSidebar } from '@/components/user-dashboard/projects/project-edit-sidebar'
import { ServerEditSidebar } from '@/components/user-dashboard/servers/server-edit-sidebar'

const SERVER_EDIT_PATTERN = /^\/dashboard\/servers\/([^/]+)\/edit/
const PROJECT_EDIT_PATTERN = /^\/dashboard\/projects\/([^/]+)\/edit/
const ORG_PATTERN = /^\/dashboard\/organizations\/([^/]+)/

interface DashboardSidebarProps extends React.ComponentProps<typeof Sidebar> {
	socials?: {
		discord?: string
		youtube?: string
		instagram?: string
		bluesky?: string
		tiktok?: string
	}
}

export function DashboardSidebar({ socials, ...props }: DashboardSidebarProps) {
	const pathname = usePathname()
	const editMatch = pathname.match(SERVER_EDIT_PATTERN)
	const projectEditMatch = pathname.match(PROJECT_EDIT_PATTERN)
	const orgMatch = pathname.match(ORG_PATTERN)

	if (editMatch) {
		return <ServerEditSidebar slug={editMatch[1]} {...props} />
	}

	if (projectEditMatch) {
		return <ProjectEditSidebar slug={projectEditMatch[1]} {...props} />
	}

	if (orgMatch) {
		return <OrgSidebar slug={orgMatch[1]} socials={socials} {...props} />
	}

	return <AppSidebar socials={socials} {...props} />
}
