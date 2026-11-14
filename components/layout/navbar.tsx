'use client'

import {
	ArrowDown01Icon,
	Layers01Icon,
	Settings02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@/components/ba-ui/user/user-button'
import { BrandMark } from '@/components/brand-mark'
import { useAccountLinks } from '@/components/layout/account-links'
import { CreateMenu } from '@/components/layout/create-menu'
import { NotificationBell } from '@/components/social/notification-bell'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/convex/_generated/api'
import {
	homeNavigation,
	pluginsNavigation,
	publicNavigation,
	toolsNavigation,
} from '@/lib/site'
import { cn } from '@/lib/utils'

const DESKTOP_LINK_CLASS =
	'rounded-md px-3.5 py-1.5 font-display font-semibold text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
const MOBILE_LINK_CLASS =
	'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-muted-foreground'

function isActiveRoute(pathname: string, url: string) {
	if (url === '/') {
		return pathname === url
	}

	return pathname === url || pathname.startsWith(`${url}/`)
}

interface MenuLink {
	href: string
	label: string
	icon: IconSvgElement
	description?: string
}

/** A group of links behind one nav button (Tools; Projects on phones). */
function NavMenu({
	pathname,
	label,
	icon,
	items,
	mobile = false,
}: {
	pathname: string
	label: string
	icon: IconSvgElement
	items: readonly MenuLink[]
	mobile?: boolean
}) {
	const isActive = items.some((item) => isActiveRoute(pathname, item.href))
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					mobile
						? MOBILE_LINK_CLASS
						: cn(
								DESKTOP_LINK_CLASS,
								'inline-flex items-center gap-1',
							),
					isActive &&
						(mobile
							? 'bg-primary text-primary-foreground'
							: 'bg-accent text-foreground shadow-[inset_0_-2px_0_var(--primary)]'),
				)}
			>
				{mobile ? (
					<>
						<HugeiconsIcon
							aria-hidden
							className="size-5"
							icon={icon}
							strokeWidth={2}
						/>
						<span className="truncate font-medium text-[11px]">
							{label}
						</span>
					</>
				) : (
					<>
						{label}
						<HugeiconsIcon
							aria-hidden
							className="size-3.5"
							icon={ArrowDown01Icon}
						/>
					</>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={mobile ? 'center' : 'start'}
				className="w-64"
				side={mobile ? 'top' : 'bottom'}
				sideOffset={mobile ? 12 : 8}
			>
				<DropdownMenuGroup>
					{items.map((item) => (
						<DropdownMenuItem
							className={cn(
								'gap-3 py-2',
								item.description && 'items-start',
								isActiveRoute(pathname, item.href) &&
									'bg-accent text-accent-foreground',
							)}
							key={item.href}
							nativeButton={false}
							render={(props) => (
								<Link {...props} href={item.href} />
							)}
						>
							<HugeiconsIcon
								aria-hidden
								className={cn(item.description && 'mt-0.5')}
								icon={item.icon}
							/>
							<span className="flex flex-col gap-0.5">
								<span className="font-medium">
									{item.label}
								</span>
								{item.description ? (
									<span className="text-muted-foreground text-xs">
										{item.description}
									</span>
								) : null}
							</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function Navbar({
	pluginsEnabled: initialPluginsEnabled,
}: {
	/** From the server render, so Plugins shows without a flash. */
	pluginsEnabled: boolean
}) {
	const pathname = usePathname()
	const features = useQuery(api.functions.site.settings.getFeatures, {})
	const pluginsEnabled = features
		? features.pluginsEnabled === true
		: initialPluginsEnabled
	const desktopNavigation = pluginsEnabled
		? [...publicNavigation, pluginsNavigation]
		: publicNavigation
	// Phones fit five buttons, so the content listings share one menu.
	const [serversNavigation, ...contentNavigation] = desktopNavigation
	const mobileNavigation = [homeNavigation, serversNavigation]
	const accountLinks = useAccountLinks(initialPluginsEnabled)

	return (
		<>
			<header className="sticky top-0 z-40 hidden border-b bg-background/75 backdrop-blur-xl lg:block">
				<nav
					aria-label="Primary navigation"
					className="container mx-auto flex h-16 items-center gap-6 px-4 md:px-6"
				>
					<BrandMark imageClassName="w-36" priority withIcon />

					<div className="flex items-center gap-1">
						{desktopNavigation.map((item) => {
							const isActive = isActiveRoute(pathname, item.href)

							return (
								<Link
									aria-current={isActive ? 'page' : undefined}
									className={cn(
										DESKTOP_LINK_CLASS,
										isActive &&
											'bg-accent text-foreground shadow-[inset_0_-2px_0_var(--primary)]',
									)}
									href={item.href}
									key={item.href}
								>
									{item.label}
								</Link>
							)
						})}
						<NavMenu
							icon={Settings02Icon}
							items={toolsNavigation}
							label="Tools"
							pathname={pathname}
						/>
					</div>

					<div className="ml-auto flex items-center gap-2.5">
						<NotificationBell />
						<CreateMenu />
						<UserButton links={accountLinks} size="icon" />
					</div>
				</nav>
			</header>

			<header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur-xl lg:hidden">
				<BrandMark imageClassName="w-28" priority withIcon />
				<NotificationBell />
			</header>

			<nav
				aria-label="Mobile navigation"
				className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
			>
				<div className="mx-auto flex max-w-md items-stretch">
					{mobileNavigation.map((item) => {
						const isActive = isActiveRoute(pathname, item.href)

						return (
							<Link
								aria-current={isActive ? 'page' : undefined}
								aria-label={item.label}
								className={cn(
									MOBILE_LINK_CLASS,
									isActive &&
										'bg-primary text-primary-foreground',
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
								<span className="max-w-full truncate font-medium text-[11px]">
									{item.label}
								</span>
							</Link>
						)
					})}
					<NavMenu
						icon={Layers01Icon}
						items={contentNavigation}
						label="Projects"
						mobile
						pathname={pathname}
					/>
					<NavMenu
						icon={Settings02Icon}
						items={toolsNavigation}
						label="Tools"
						mobile
						pathname={pathname}
					/>
					<div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-muted-foreground">
						<UserButton
							align="center"
							className="size-5"
							links={accountLinks}
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
