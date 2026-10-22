'use client'

import { usePathname } from 'next/navigation'
import type * as React from 'react'
import type { Sidebar } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/user-dashboard/app-sidebar'
import { OrgSidebar } from '@/components/user-dashboard/organizations/org-sidebar'
import { PluginEditSidebar } from '@/components/user-dashboard/plugins/plugin-edit-sidebar'
import { ProjectEditSidebar } from '@/components/user-dashboard/projects/project-edit-sidebar'
import { ServerEditSidebar } from '@/components/user-dashboard/servers/server-edit-sidebar'

// An item's settings live at /dashboard/<type>/<id>/…, apart from the add
// pages (and the GitHub repositories page for plugins).
const SERVER_EDIT_PATTERN = /^\/dashboard\/servers\/(?!add(?:\/|$))([^/]+)/
const PROJECT_EDIT_PATTERN = /^\/dashboard\/projects\/(?!add(?:\/|$))([^/]+)/
const PLUGIN_EDIT_PATTERN =
	/^\/dashboard\/plugins\/(?!new(?:\/|$)|repositories(?:\/|$))([^/]+)/
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
	const pluginEditMatch = pathname.match(PLUGIN_EDIT_PATTERN)

	if (editMatch) {
		return <ServerEditSidebar id={editMatch[1]} {...props} />
	}

	if (projectEditMatch) {
		return <ProjectEditSidebar id={projectEditMatch[1]} {...props} />
	}

	if (pluginEditMatch) {
		return <PluginEditSidebar id={pluginEditMatch[1]} {...props} />
	}

	if (orgMatch) {
		return <OrgSidebar slug={orgMatch[1]} socials={socials} {...props} />
	}

	return <AppSidebar socials={socials} {...props} />
}
