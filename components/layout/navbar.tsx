'use client'

import {
	DashboardBrowsingIcon,
	OfficeIcon,
	Package01Icon,
	ServerStack01Icon,
	UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	UserButton,
	type UserButtonLink,
} from '@/components/ba-ui/user/user-button'
import { BrandMark } from '@/components/brand-mark'
import { homeNavigation, publicNavigation } from '@/lib/site'
import { cn } from '@/lib/utils'

const mobileNavigation = [homeNavigation, ...publicNavigation]

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

function isActiveRoute(pathname: string, url: string) {
	if (url === '/') {
		return pathname === url
	}

	return pathname === url || pathname.startsWith(`${url}/`)
}

export function Navbar() {
	const pathname = usePathname()

	return (
		<>
			<header className="hidden lg:block">
				<nav
					aria-label="Primary navigation"
					className="container mx-auto px-4 md:px-6"
				>
					<div className="grid h-20 grid-cols-[1fr_auto_1fr] items-center">
						<BrandMark priority />

						<div className="flex items-center gap-1">
							{publicNavigation.map((item) => {
								const isActive = isActiveRoute(
									pathname,
									item.href,
								)

								return (
									<Link
										aria-current={
											isActive ? 'page' : undefined
										}
										className={cn(
											'flex items-center gap-2 rounded-md px-4 py-2 font-medium text-muted-foreground text-sm transition-[color,background-color,filter] hover:bg-primary hover:text-primary-foreground hover:brightness-95',
											isActive &&
												'bg-primary text-primary-foreground shadow-sm',
										)}
										href={item.href}
										key={item.href}
									>
										<HugeiconsIcon
											aria-hidden
											className="size-4.25"
											icon={item.icon}
											strokeWidth={1.8}
										/>
										{item.label}
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
					{mobileNavigation.map((item) => {
						const isActive = isActiveRoute(pathname, item.href)

						return (
							<Link
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-muted-foreground',
									isActive &&
										'bg-background text-foreground shadow-sm',
								)}
								href={item.href}
								key={item.href}
							>
								<HugeiconsIcon
									aria-hidden
									className="size-5"
									icon={item.icon}
									strokeWidth={2}
								/>
								<span className="truncate font-medium text-[11px]">
									{'mobileLabel' in item
										? item.mobileLabel
										: item.label}
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
