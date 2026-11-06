'use client'

import {
	CheckmarkCircle01Icon,
	DashboardBrowsingIcon,
	Image02Icon,
	PlugSocketIcon,
	PuzzleIcon,
	ServerStack03Icon,
} from '@hugeicons/core-free-icons'
import { usePathname } from 'next/navigation'
import type * as React from 'react'
import { AdminReviewSidebar } from '@/components/admin-dashboard/admin-review-sidebar'
import { SidebarNav } from '@/components/sidebar/sidebar-nav'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import { adminReviewTarget } from '@/lib/admin-review-navigation'

const REVIEW_ITEMS = [
	{
		title: 'Awaiting review',
		url: '/moderation',
		icon: CheckmarkCircle01Icon,
		exactMatch: true,
	},
]

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

export function ModerationSidebar({
	isAdmin,
	...props
}: React.ComponentProps<typeof Sidebar> & { isAdmin: boolean }) {
	const target = adminReviewTarget(usePathname())
	if (target) {
		return (
			<AdminReviewSidebar
				key={`${target.kind}/${target.id}`}
				target={target}
				{...props}
			/>
		)
	}
	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarContent>
				<SidebarNav
					basePath="/moderation"
					groupLabel="Moderation"
					items={REVIEW_ITEMS}
				/>
				<SidebarNav
					basePath="/moderation"
					groupLabel="Content"
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
