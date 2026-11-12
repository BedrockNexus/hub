'use client'

import {
	CheckmarkCircle01Icon,
	DashboardBrowsingIcon,
	Image02Icon,
	PlugSocketIcon,
	PuzzleIcon,
	ServerStack03Icon,
} from '@hugeicons/core-free-icons'
import { useQuery } from 'convex/react'
import { usePathname } from 'next/navigation'
import type * as React from 'react'
import { SidebarNav } from '@/components/sidebar/sidebar-nav'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import { api } from '@/convex/_generated/api'
import { adminReviewTarget } from '@/lib/admin-review-navigation'

const CONTENT_ITEMS = [
	{
		title: 'Servers',
		url: '/moderation/servers',
		icon: ServerStack03Icon,
	},
	{
		title: 'Addons',
		url: '/moderation/addons',
		icon: PuzzleIcon,
	},
	{
		title: 'Resource Packs',
		url: '/moderation/resource-packs',
		icon: Image02Icon,
	},
	{
		title: 'Plugins',
		url: '/moderation/plugins',
		icon: PlugSocketIcon,
	},
]

const ADMIN_ITEMS = [
	{
		title: 'Admin dashboard',
		url: '/admin',
		icon: DashboardBrowsingIcon,
		exactMatch: true,
	},
]

function QueueNav() {
	const queue = useQuery(api.functions.moderation.work.queue, {})
	const waiting = queue?.rows.length
	return (
		<SidebarNav
			basePath="/moderation"
			groupLabel="Moderation"
			items={[
				{
					title: 'Review queue',
					url: '/moderation',
					icon: CheckmarkCircle01Icon,
					exactMatch: true,
					badge: waiting
						? `${waiting}${queue?.more ? '+' : ''}`
						: undefined,
				},
			]}
		/>
	)
}

/**
 * Review pages have their own way back to the queue and use the full width,
 * so the sidebar is left out there.
 */
export function ModerationSidebar({
	isAdmin,
	...props
}: React.ComponentProps<typeof Sidebar> & { isAdmin: boolean }) {
	if (adminReviewTarget(usePathname())) {
		return null
	}
	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarContent>
				<QueueNav />
				<SidebarNav
					basePath="/moderation"
					groupLabel="All content"
					items={CONTENT_ITEMS}
				/>
				{isAdmin ? (
					<SidebarNav
						basePath="/admin"
						groupLabel="Admin"
						items={ADMIN_ITEMS}
					/>
				) : null}
			</SidebarContent>
		</Sidebar>
	)
}
