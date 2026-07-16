'use client'

import {
	Analytics01Icon,
	DashboardBrowsingIcon,
	GridIcon,
	OfficeIcon,
	Package01Icon,
	PuzzleIcon,
	ServerStack03Icon,
	Settings01Icon,
	UserGroupIcon,
} from '@hugeicons/core-free-icons'
import type * as React from 'react'
import { SidebarNav } from '@/components/sidebar/sidebar-nav'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'

const data = {
	navMain: [
		{
			title: 'Dashboard',
			url: '/admin',
			icon: DashboardBrowsingIcon,
			exactMatch: true,
		},
	],
	navModeration: [
		{
			title: 'Servers',
			url: '/admin/servers',
			icon: ServerStack03Icon,
		},
		{
			title: 'Projects',
			url: '/admin/projects',
			icon: PuzzleIcon,
		},
	],
	navPeople: [
		{
			title: 'Users',
			url: '/admin/users',
			icon: UserGroupIcon,
		},
		{
			title: 'Organizations',
			url: '/admin/organizations',
			icon: OfficeIcon,
		},
	],
	navContent: [
		{
			title: 'Game Versions',
			url: '/admin/game-versions',
			icon: Package01Icon,
		},
		{
			title: 'Categories',
			url: '/admin/categories',
			icon: GridIcon,
		},
	],
	navSystem: [
		{
			title: 'Analytics',
			url: '/admin/analytics',
			icon: Analytics01Icon,
		},
		{
			title: 'Settings',
			url: '/admin/settings',
			icon: Settings01Icon,
		},
	],
}

export function AdminDashboardSidebar(
	props: React.ComponentProps<typeof Sidebar>,
) {
	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarContent>
				<SidebarNav
					basePath="/admin"
					groupLabel="Admin"
					items={data.navMain}
				/>
				<SidebarNav
					basePath="/admin"
					groupLabel="Moderation"
					items={data.navModeration}
				/>
				<SidebarNav
					basePath="/admin"
					groupLabel="People"
					items={data.navPeople}
				/>
				<SidebarNav
					basePath="/admin"
					groupLabel="Content"
					items={data.navContent}
				/>
				<SidebarNav
					basePath="/admin"
					groupLabel="System"
					items={data.navSystem}
				/>
			</SidebarContent>
		</Sidebar>
	)
}
