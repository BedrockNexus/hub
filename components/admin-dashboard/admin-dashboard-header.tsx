'use client'

import {
	DashboardBrowsingIcon,
	Settings01Icon,
	Shield01Icon,
	UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { UserButtonLink } from '@/components/ba-ui/user/user-button'
import { WorkspaceHeader } from '@/components/workspace-header'

export function AdminDashboardHeader() {
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
			label: 'User Dashboard',
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
			label: 'Admin Dashboard',
			href: '/admin',
			icon: (
				<HugeiconsIcon
					className="text-muted-foreground"
					icon={Shield01Icon}
				/>
			),
			visibility: 'authenticated',
		},
		{
			label: 'Admin Settings',
			href: '/admin/settings',
			icon: (
				<HugeiconsIcon
					className="text-muted-foreground"
					icon={Settings01Icon}
				/>
			),
			visibility: 'authenticated',
		},
	]

	return <WorkspaceHeader label="Administration" links={userButtonLinks} />
}
