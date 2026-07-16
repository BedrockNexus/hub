'use client'

import {
	Analytics01Icon,
	BlueskyIcon,
	DashboardBrowsingIcon,
	DiscordIcon,
	FavouriteIcon,
	InstagramIcon,
	OfficeIcon,
	PuzzleIcon,
	ServerStack03Icon,
	Settings01Icon,
	TiktokIcon,
	YoutubeIcon,
} from '@hugeicons/core-free-icons'
import type * as React from 'react'
import { SidebarCollapsibleNav } from '@/components/sidebar/sidebar-collapsible-nav'
import { SidebarNav } from '@/components/sidebar/sidebar-nav'
import { SidebarSocialsNav } from '@/components/sidebar/sidebar-socials-nav'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { DashboardOrganizationSwitcher } from '@/components/user-dashboard/organizations/dashboard-organization-switcher'

const data = {
	navMain: [
		{
			title: 'Dashboard',
			url: '/dashboard',
			icon: DashboardBrowsingIcon,
			exactMatch: true,
		},
	],
	navManage: [
		{
			title: 'Servers',
			url: '/dashboard/servers',
			icon: ServerStack03Icon,
		},
		{
			title: 'Projects',
			url: '/dashboard/projects',
			icon: PuzzleIcon,
		},
		{
			title: 'Organizations',
			url: '/dashboard/organizations',
			icon: OfficeIcon,
		},
		{
			title: 'Saved',
			url: '/dashboard/saved',
			icon: FavouriteIcon,
		},
		{
			title: 'Analytics',
			url: '/dashboard/analytics',
			icon: Analytics01Icon,
		},
	],
	navSettings: [
		{
			title: 'Settings',
			url: '/dashboard/settings',
			icon: Settings01Icon,
			isActive: true,
			items: [
				{
					title: 'Profile',
					url: '/dashboard/settings/profile',
				},
				{
					title: 'Account',
					url: '/dashboard/settings/account',
				},
				{
					title: 'Providers',
					url: '/dashboard/settings/providers',
				},
				{
					title: 'Sessions',
					url: '/dashboard/settings/sessions',
				},
			],
		},
	],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	socials?: {
		discord?: string
		youtube?: string
		instagram?: string
		bluesky?: string
		tiktok?: string
	}
}

export function AppSidebar({ socials = {}, ...props }: AppSidebarProps) {
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
				<SidebarNav groupLabel="Dashboard" items={data.navMain} />
				<SidebarNav groupLabel="Manage" items={data.navManage} />
				<SidebarCollapsibleNav
					collapsibleItems={data.navSettings}
					groupLabel="Settings"
				/>
				{navSocials.length > 0 && (
					<SidebarSocialsNav className="mt-auto" items={navSocials} />
				)}
			</SidebarContent>
		</Sidebar>
	)
}
