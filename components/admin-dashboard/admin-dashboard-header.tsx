'use client'

import { LayoutDashboard, Settings, ShieldCheck, User } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {
	UserButton,
	type UserButtonLink,
} from '@/components/ba-ui/user/user-button'
import { SidebarTrigger } from '@/components/ui/sidebar'

interface AdminDashboardHeaderProps {
	siteLogoUrl?: string | null
	siteName?: string | null
}

export function AdminDashboardHeader({
	siteLogoUrl,
	siteName,
}: AdminDashboardHeaderProps) {
	const logoUrl = siteLogoUrl ?? '/images/bedrocknexus-logo.png'
	const userButtonLinks: UserButtonLink[] = [
		{
			label: 'Profile',
			href: '/dashboard/settings/profile',
			icon: <User className="text-muted-foreground" />,
			visibility: 'authenticated',
		},
		{
			label: 'User Dashboard',
			href: '/dashboard',
			icon: <LayoutDashboard className="text-muted-foreground" />,
			visibility: 'authenticated',
		},
		{
			label: 'Admin Dashboard',
			href: '/admin',
			icon: <ShieldCheck className="text-muted-foreground" />,
			visibility: 'authenticated',
		},
		{
			label: 'Admin Settings',
			href: '/admin/settings',
			icon: <Settings className="text-muted-foreground" />,
			visibility: 'authenticated',
		},
	]

	return (
		<header className="fixed top-0 right-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur-md lg:px-6">
			<div className="flex items-center gap-4">
				<SidebarTrigger className="-ml-1" />
				<Link
					aria-label={`${siteName ?? 'BedrockNexus'} home`}
					className="flex h-11 shrink-0 items-center"
					href="/"
				>
					<Image
						alt={siteName ?? 'BedrockNexus'}
						className="h-auto w-36 object-contain sm:w-40"
						height={905}
						priority
						src={logoUrl}
						unoptimized
						width={2000}
					/>
				</Link>
			</div>
			<div className="flex items-center gap-3">
				<UserButton links={userButtonLinks} size="icon" />
			</div>
		</header>
	)
}
