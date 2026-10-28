'use client'

import {
	DashboardBrowsingIcon,
	OfficeIcon,
	Package01Icon,
	PaintBrush01Icon,
	PlugSocketIcon,
	ServerStack01Icon,
	UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { UserButtonLink } from '@/components/ba-ui/user/user-button'
import { api } from '@/convex/_generated/api'
import { MAPS_UI_ENABLED } from '@/lib/maps-feature'

function linkIcon(icon: typeof UserIcon) {
	return <HugeiconsIcon className="text-muted-foreground" icon={icon} />
}

const ACCOUNT_LINKS: (UserButtonLink & { pluginsOnly?: boolean })[] = [
	...(MAPS_UI_ENABLED
		? [
				{
					label: 'Maps',
					href: '/dashboard/maps',
					icon: linkIcon(Package01Icon),
					visibility: 'authenticated' as const,
				},
			]
		: []),
	{
		label: 'Profile',
		href: '/dashboard/settings/profile',
		icon: linkIcon(UserIcon),
		visibility: 'authenticated',
	},
	{
		label: 'Dashboard',
		href: '/dashboard',
		icon: linkIcon(DashboardBrowsingIcon),
		visibility: 'authenticated',
	},
	{
		label: 'Servers',
		href: '/dashboard/servers',
		icon: linkIcon(ServerStack01Icon),
		visibility: 'authenticated',
	},
	{
		label: 'Addons',
		href: '/dashboard/addons',
		icon: linkIcon(Package01Icon),
		visibility: 'authenticated',
	},
	{
		label: 'Resource Packs',
		href: '/dashboard/resource-packs',
		icon: linkIcon(PaintBrush01Icon),
		visibility: 'authenticated',
	},
	{
		label: 'Plugins',
		href: '/dashboard/plugins',
		icon: linkIcon(PlugSocketIcon),
		visibility: 'authenticated',
		pluginsOnly: true,
	},
	{
		label: 'Organization',
		href: '/dashboard/organizations',
		icon: linkIcon(OfficeIcon),
		visibility: 'authenticated',
	},
]

/**
 * The account menu's links, the same in the site navbar and the dashboard
 * header. Plugins shows while the Plugins feature is on.
 */
export function useAccountLinks(initialPluginsEnabled = false) {
	const features = useQuery(api.functions.site.settings.getFeatures, {})
	const pluginsEnabled = features
		? features.pluginsEnabled === true
		: initialPluginsEnabled
	return ACCOUNT_LINKS.filter(
		(link) => pluginsEnabled || !link.pluginsOnly,
	).map(({ pluginsOnly: _pluginsOnly, ...link }) => link)
}
