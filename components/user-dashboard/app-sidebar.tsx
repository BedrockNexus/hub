'use client'

import {
	BlueskyIcon,
	DashboardBrowsingIcon,
	DiscordIcon,
	FavouriteIcon,
	InstagramIcon,
	OfficeIcon,
	PaintBrush01Icon,
	PlugSocketIcon,
	PuzzleIcon,
	ServerStack03Icon,
	Settings01Icon,
	TiktokIcon,
	YoutubeIcon,
} from '@hugeicons/core-free-icons'
import { useQuery } from 'convex/react'
import type * as React from 'react'
import { SidebarCollapsibleNav } from '@/components/sidebar/sidebar-collapsible-nav'
import { SidebarNav } from '@/components/sidebar/sidebar-nav'
import { SidebarSocialsNav } from '@/components/sidebar/sidebar-socials-nav'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { DashboardOrganizationSwitcher } from '@/components/user-dashboard/organizations/dashboard-organization-switcher'
import { api } from '@/convex/_generated/api'

const PLUGINS_URL = '/dashboard/plugins'

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
			title: 'Addons',
			url: '/dashboard/addons',
			icon: PuzzleIcon,
		},
		{
			title: 'Resource Packs',
			url: '/dashboard/resource-packs',
			icon: PaintBrush01Icon,
		},
		{
			title: 'Plugins',
			url: PLUGINS_URL,
			icon: PlugSocketIcon,
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
	// Plugin publishing appears only while the feature is switched on.
	const pluginsEnabled =
		useQuery(api.functions.site.settings.getFeatures, {})
			?.pluginsEnabled === true
	const navManage = data.navManage.filter(
		(item) => pluginsEnabled || item.url !== PLUGINS_URL,
	)

	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarHeader>
				<DashboardOrganizationSwitcher />
			</SidebarHeader>
			<SidebarContent>
				<SidebarNav groupLabel="Dashboard" items={data.navMain} />
				<SidebarNav groupLabel="Manage" items={navManage} />
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
