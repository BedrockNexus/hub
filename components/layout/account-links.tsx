'use client'

import {
	Bookmark02Icon,
	CheckmarkCircle01Icon,
	DashboardBrowsingIcon,
	OfficeIcon,
	Package01Icon,
	PaintBrush01Icon,
	PlugSocketIcon,
	ServerStack01Icon,
	Shield01Icon,
	UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { UserButtonLink } from '@/components/ba-ui/user/user-button'
import { api } from '@/convex/_generated/api'
import { canModerate, isAdminRole } from '@/convex/lib/roles'
import { authClient } from '@/lib/auth-client'

function linkIcon(icon: typeof UserIcon) {
	return <HugeiconsIcon className="text-muted-foreground" icon={icon} />
}

const ACCOUNT_LINKS: (UserButtonLink & { pluginsOnly?: boolean })[] = [
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
		label: 'Library',
		href: '/dashboard/library',
		icon: linkIcon(Bookmark02Icon),
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

const MODERATION_LINK: UserButtonLink = {
	label: 'Moderation',
	href: '/moderation',
	icon: linkIcon(CheckmarkCircle01Icon),
	visibility: 'authenticated',
}

const ADMIN_LINK: UserButtonLink = {
	label: 'Admin',
	href: '/admin',
	icon: linkIcon(Shield01Icon),
	visibility: 'authenticated',
}

/**
 * The account menu's links, the same in the site navbar and every dashboard
 * header. Plugins shows while the Plugins feature is on; Moderation and Admin
 * show for the roles that can open them (the pages check the role again).
 */
export function useAccountLinks(initialPluginsEnabled = false) {
	const features = useQuery(api.functions.site.settings.getFeatures, {})
	const { data: session } = authClient.useSession()
	const role = session?.user.role
	const pluginsEnabled = features
		? features.pluginsEnabled === true
		: initialPluginsEnabled
	const links = ACCOUNT_LINKS.filter(
		(link) => pluginsEnabled || !link.pluginsOnly,
	).map(({ pluginsOnly: _pluginsOnly, ...link }) => link)
	if (canModerate(role)) {
		links.push(MODERATION_LINK)
	}
	if (isAdminRole(role)) {
		links.push(ADMIN_LINK)
	}
	return links
}
