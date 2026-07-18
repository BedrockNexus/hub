'use client'

import {
	DashboardBrowsingIcon,
	Home01Icon,
	OfficeIcon,
	Package01Icon,
	ServerStack01Icon,
	UserIcon,
	Wifi01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	UserButton,
	type UserButtonLink,
} from '@/components/ba-ui/user/user-button'
import { cn } from '@/lib/utils'

interface NavbarMenuItem {
	title: string
	url: string
	icon: IconSvgElement
}

const mobileMenuItems: NavbarMenuItem[] = [
	{
		title: 'Home',
		url: '/',
		icon: Home01Icon,
	},
	{
		title: 'Servers',
		url: '/servers',
		icon: ServerStack01Icon,
	},
	{
		title: 'Projects',
		url: '/projects',
		icon: Package01Icon,
	},
	{
		title: 'Ping',
		url: '/tools/server-ping',
		icon: Wifi01Icon,
	},
]

const desktopMenuItems: NavbarMenuItem[] = [
	{
		title: 'Servers',
		url: '/servers',
		icon: ServerStack01Icon,
	},
	{
		title: 'Projects',
		url: '/projects',
		icon: Package01Icon,
	},
	{
		title: 'Server Ping',
		url: '/tools/server-ping',
		icon: Wifi01Icon,
	},
]

const userButtonLinks: UserButtonLink[] = [
	{
		label: 'Profile',
		href: '/dashboard/settings/profile',
		icon: (
			<HugeiconsIcon className="text-muted-foreground" icon={UserIcon} />
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
		label: 'Projects',
		href: '/dashboard/projects',
		icon: (
			<HugeiconsIcon
				className="text-muted-foreground"
				icon={Package01Icon}
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

interface NavbarProps {
	siteLogo?: string
	siteName?: string
}

function isActiveRoute(pathname: string, url: string) {
	if (url === '/') {
		return pathname === url
	}

	return pathname === url || pathname.startsWith(`${url}/`)
}

export function Navbar({
	siteLogo = '/images/bedrocknexus-logo.png',
	siteName = 'BedrockNexus',
}: NavbarProps) {
	const pathname = usePathname()

	return (
		<>
			{/* if we ever want to make the nav sticky "sticky top-0 z-50 border-b bg-muted"  */}
			<header className="hidden lg:block">
				<nav
					aria-label="Primary navigation"
					className="container mx-auto px-4 md:px-6"
				>
					<div className="grid h-20 grid-cols-[1fr_auto_1fr] items-center">
						<Link
							aria-label={`${siteName} home`}
							className="flex w-fit items-center"
							href="/"
						>
							<Image
								alt={siteName}
								className="h-auto w-44"
								height={905}
								src={siteLogo}
								width={2000}
							/>
						</Link>

						<div className="flex items-center gap-1">
							{desktopMenuItems.map((item) => {
								const isActive = isActiveRoute(
									pathname,
									item.url,
								)

								return (
									<Link
										aria-current={
											isActive ? 'page' : undefined
										}
										className={cn(
											'flex items-center gap-2 rounded-md px-4 py-2 font-medium text-muted-foreground text-sm hover:bg-primary/40 hover:text-foreground',
											isActive &&
												'bg-primary/40 text-foreground shadow-sm hover:bg-primary/40',
										)}
										href={item.url}
										key={item.url}
									>
										<HugeiconsIcon
											aria-hidden
											className="size-4.25"
											icon={item.icon}
											strokeWidth={1.8}
										/>
										{item.title}
									</Link>
								)
							})}
						</div>

						<div className="flex items-center justify-end">
							<UserButton links={userButtonLinks} size="icon" />
						</div>
					</div>
				</nav>
			</header>

			<nav
				aria-label="Mobile navigation"
				className="fixed inset-x-0 bottom-0 z-50 border-t bg-muted/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
			>
				<div className="mx-auto flex max-w-md items-stretch">
					{mobileMenuItems.map((item) => {
						const isActive = isActiveRoute(pathname, item.url)

						return (
							<Link
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-muted-foreground',
									isActive &&
										'bg-background text-primary shadow-sm',
								)}
								href={item.url}
								key={item.url}
							>
								<HugeiconsIcon
									aria-hidden
									className="size-5"
									icon={item.icon}
									strokeWidth={2}
								/>
								<span className="truncate font-medium text-[11px]">
									{item.title}
								</span>
							</Link>
						)
					})}
					<div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-muted-foreground">
						<UserButton
							align="center"
							className="size-5"
							links={userButtonLinks}
							sideOffset={12}
							size="icon"
							variant="ghost"
						/>
						<span className="truncate font-medium text-[11px]">
							Account
						</span>
					</div>
				</div>
			</nav>
		</>
	)
}
