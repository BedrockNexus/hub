'use client'

import {
	DashboardBrowsingIcon,
	OfficeIcon,
	ServerStack01Icon,
	UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { UserButtonLink } from '@/components/ba-ui/user/user-button'
import { WorkspaceHeader } from '@/components/workspace-header'

export function DashboardHeader() {
	const userButtonLinks: UserButtonLink[] = [
		{
			label: 'Profile',
			href: '/dashboard/settings/profile',
			icon: (
				<HugeiconsIcon
					className="text-muted-foreground"
					icon={UserIcon}
				/>
			),
			visibility: 'authenticated',
		},
		{
			label: 'Dashboard',
			href: '/dashboard',
			icon: (
				<HugeiconsIcon
					className="text-muted-foreground"
					icon={DashboardBrowsingIcon}
				/>
			),
			visibility: 'authenticated',
		},
		{
			label: 'Servers',
			href: '/dashboard/servers',
			icon: (
				<HugeiconsIcon
					className="text-muted-foreground"
					icon={ServerStack01Icon}
				/>
			),
			visibility: 'authenticated',
		},
		{
			label: 'Organization',
			href: '/dashboard/organizations',
			icon: (
				<HugeiconsIcon
					className="text-muted-foreground"
					icon={OfficeIcon}
				/>
			),
			visibility: 'authenticated',
		},
	]

	return <WorkspaceHeader label="Creator dashboard" links={userButtonLinks} />
}
