'use client'

import {
	CheckmarkCircle01Icon,
	DashboardBrowsingIcon,
	Shield01Icon,
	UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { UserButtonLink } from '@/components/ba-ui/user/user-button'
import { WorkspaceHeader } from '@/components/workspace-header'

function linkIcon(icon: typeof UserIcon) {
	return <HugeiconsIcon className="text-muted-foreground" icon={icon} />
}

export function ModerationHeader({ isAdmin }: { isAdmin: boolean }) {
	const links: UserButtonLink[] = [
		{
			label: 'Profile',
			href: '/dashboard/settings/profile',
			icon: linkIcon(UserIcon),
			visibility: 'authenticated',
		},
		{
			label: 'User Dashboard',
			href: '/dashboard',
			icon: linkIcon(DashboardBrowsingIcon),
			visibility: 'authenticated',
		},
		{
			label: 'Moderation',
			href: '/moderation',
			icon: linkIcon(CheckmarkCircle01Icon),
			visibility: 'authenticated',
		},
	]
	if (isAdmin) {
		links.push({
			label: 'Admin Dashboard',
			href: '/admin',
			icon: linkIcon(Shield01Icon),
			visibility: 'authenticated',
		})
	}
	return <WorkspaceHeader label="Moderation" links={links} />
}
