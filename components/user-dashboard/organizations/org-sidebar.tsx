'use client'

import {
	BlueskyIcon,
	DashboardBrowsingIcon,
	DiscordIcon,
	InstagramIcon,
	PuzzleIcon,
	ServerStack03Icon,
	Settings01Icon,
	TiktokIcon,
	UserGroupIcon,
	YoutubeIcon,
} from '@hugeicons/core-free-icons'
import type * as React from 'react'
import { SidebarNav } from '@/components/sidebar/sidebar-nav'
import { SidebarSocialsNav } from '@/components/sidebar/sidebar-socials-nav'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { DashboardOrganizationSwitcher } from '@/components/user-dashboard/organizations/dashboard-organization-switcher'

function getOrgNav(slug: string) {
	const base = `/dashboard/organizations/${slug}`
	return {
		navMain: [
			{
				title: 'Overview',
				url: base,
				icon: DashboardBrowsingIcon,
				exactMatch: true,
			},
		],
		navManage: [
			{
				title: 'Servers',
				url: `${base}/servers`,
				icon: ServerStack03Icon,
			},
			{
				title: 'Projects',
				url: `${base}/projects`,
				icon: PuzzleIcon,
			},
			{
				title: 'Members',
				url: `${base}/members`,
				icon: UserGroupIcon,
			},
		],
		navSettings: [
			{
				title: 'Settings',
				url: `${base}/settings`,
				icon: Settings01Icon,
			},
		],
	}
}

interface OrgSidebarProps extends React.ComponentProps<typeof Sidebar> {
	slug: string
	socials?: {
		discord?: string
		youtube?: string
		instagram?: string
		bluesky?: string
		tiktok?: string
	}
}

export function OrgSidebar({ slug, socials = {}, ...props }: OrgSidebarProps) {
	const data = getOrgNav(slug)

	const navSocials = [
		{ title: 'Discord', url: socials.discord, icon: DiscordIcon },
		{ title: 'YouTube', url: socials.youtube, icon: YoutubeIcon },
		{ title: 'Instagram', url: socials.instagram, icon: InstagramIcon },
		{ title: 'Bluesky', url: socials.bluesky, icon: BlueskyIcon },
		{ title: 'TikTok', url: socials.tiktok, icon: TiktokIcon },
	].filter((social) => social.url) as Array<{
		title: string
		url: string
		icon: typeof DiscordIcon
	}>

	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarHeader>
				<DashboardOrganizationSwitcher />
			</SidebarHeader>
			<SidebarContent>
				<SidebarNav groupLabel="Organization" items={data.navMain} />
				<SidebarNav groupLabel="Manage" items={data.navManage} />
				<SidebarNav groupLabel="Settings" items={data.navSettings} />
				{navSocials.length > 0 && (
					<SidebarSocialsNav className="mt-auto" items={navSocials} />
				)}
			</SidebarContent>
		</Sidebar>
	)
}
