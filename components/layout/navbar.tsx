'use client'

import { ArrowDown01Icon, Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@/components/ba-ui/user/user-button'
import { BrandMark } from '@/components/brand-mark'
import { useAccountLinks } from '@/components/layout/account-links'
import { CreateMenu } from '@/components/layout/create-menu'
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
	'border-transparent border-b-2 py-2 font-display font-semibold text-[15px] text-muted-foreground transition-colors hover:text-foreground'
const MOBILE_LINK_CLASS =
	'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-muted-foreground'

function isActiveRoute(pathname: string, url: string) {
	if (url === '/') {
		return pathname === url
	}

	return pathname === url || pathname.startsWith(`${url}/`)
}

/** Server Ping and future tools, in one menu. */
function ToolsMenu({
	pathname,
	mobile = false,
}: {
	pathname: string
	mobile?: boolean
}) {
	const isActive = toolsNavigation.some((item) =>
		isActiveRoute(pathname, item.href),
	)
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
							: 'border-primary text-foreground'),
				)}
			>
				{mobile ? (
					<>
						<HugeiconsIcon
							aria-hidden
							className="size-5"
							icon={Settings02Icon}
							strokeWidth={2}
						/>
						<span className="truncate font-medium text-[11px]">
							Tools
						</span>
					</>
				) : (
					<>
						Tools
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
					{toolsNavigation.map((item) => (
						<DropdownMenuItem
							className="items-start gap-3 py-2"
							key={item.href}
							nativeButton={false}
							render={(props) => (
								<Link {...props} href={item.href} />
							)}
						>
							<HugeiconsIcon
								aria-hidden
								className="mt-0.5"
								icon={item.icon}
							/>
							<span className="flex flex-col gap-0.5">
								<span className="font-medium">
									{item.label}
								</span>
								<span className="text-muted-foreground text-xs">
									{item.description}
								</span>
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
	const mobileNavigation = [homeNavigation, ...desktopNavigation]
	const accountLinks = useAccountLinks(initialPluginsEnabled)

	return (
		<>
			<header className="hidden border-b bg-background/95 backdrop-blur lg:block">
				<nav
					aria-label="Primary navigation"
					className="container mx-auto flex h-18 items-center gap-8 px-4 md:px-6"
				>
					<BrandMark imageClassName="w-36" priority withIcon />

					<div className="flex items-center gap-6">
						{desktopNavigation.map((item) => {
							const isActive = isActiveRoute(pathname, item.href)

							return (
								<Link
									aria-current={isActive ? 'page' : undefined}
									className={cn(
										DESKTOP_LINK_CLASS,
										isActive &&
											'border-primary text-foreground',
									)}
									href={item.href}
									key={item.href}
								>
									{item.label}
								</Link>
							)
						})}
						<ToolsMenu pathname={pathname} />
					</div>

					<div className="ml-auto flex items-center gap-2.5">
						<CreateMenu />
						<UserButton links={accountLinks} size="icon" />
					</div>
				</nav>
			</header>

			<header className="flex h-16 items-center justify-between gap-3 border-b bg-background px-4 lg:hidden">
				<BrandMark imageClassName="w-28" priority withIcon />
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
								<span className="truncate font-medium text-[11px]">
									{item.label}
								</span>
							</Link>
						)
					})}
					<ToolsMenu mobile pathname={pathname} />
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
