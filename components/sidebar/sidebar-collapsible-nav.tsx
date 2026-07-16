'use client'

import { ArrowRight01Icon, type DiscordIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	type ComponentPropsWithoutRef,
	useCallback,
	useEffect,
	useState,
} from 'react'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from '@/components/ui/sidebar'

type HugeIcon = typeof DiscordIcon

export function SidebarCollapsibleNav({
	collapsibleItems,
	groupLabel,
	basePath = '/dashboard',
	...props
}: {
	collapsibleItems?: {
		title: string
		url: string
		icon: HugeIcon
		isActive?: boolean
		items?: {
			title: string
			url: string
		}[]
	}[]
	groupLabel: string
	basePath?: string
} & ComponentPropsWithoutRef<typeof SidebarGroup>) {
	const path = usePathname()

	const getHref = useCallback(
		(url: string) => {
			return url.startsWith('/') ? url : `${basePath}/${url}`
		},
		[basePath],
	)

	// Check if item is active based on current path
	const isItemActive = useCallback(
		(url: string) => {
			if (!path) {
				return false
			}
			const fullUrl = url.startsWith('/') ? url : `${basePath}/${url}`
			return path.startsWith(fullUrl)
		},
		[basePath, path],
	)

	// Initialize open state based on whether item is active
	const getInitialOpenState = useCallback(() => {
		const initial: Record<string, boolean> = {}
		if (!collapsibleItems) {
			return initial
		}
		for (const item of collapsibleItems) {
			if (!item.items) {
				continue
			}
			const isActive = item.isActive ?? isItemActive(item.url)
			initial[item.title] = isActive
		}
		return initial
	}, [collapsibleItems, isItemActive])

	// Track open state for each collapsible item - always initialize with values
	const [openItems, setOpenItems] =
		useState<Record<string, boolean>>(getInitialOpenState)

	// Update open state when route changes to auto-expand active items
	useEffect(() => {
		if (!collapsibleItems) {
			return
		}
		for (const item of collapsibleItems) {
			if (item.items && isItemActive(item.url)) {
				// eslint-disable-next-line react-hooks/set-state-in-effect -- keep the active sidebar group open after route changes.
				setOpenItems((prev) => ({ ...prev, [item.title]: true }))
			}
		}
	}, [collapsibleItems, isItemActive])

	const handleOpenChange = (title: string, open: boolean) => {
		setOpenItems((prev) => ({ ...prev, [title]: open }))
	}

	// Helper to get open state - ensures we always return a boolean
	const getOpenState = (title: string): boolean => {
		return openItems[title] === true
	}

	return (
		<SidebarGroup {...props}>
			<SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{collapsibleItems?.map((item) =>
						item.items ? (
							<Collapsible
								className="group/collapsible"
								key={item.title}
								onOpenChange={(open) =>
									handleOpenChange(item.title, open)
								}
								open={getOpenState(item.title)}
							>
								<SidebarMenuItem>
									<CollapsibleTrigger
										render={
											<SidebarMenuButton
												tooltip={item.title}
											/>
										}
									>
										{item.icon && (
											<HugeiconsIcon
												icon={item.icon}
												size={16}
											/>
										)}
										<span>{item.title}</span>
										<HugeiconsIcon
											className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
											icon={ArrowRight01Icon}
											size={16}
										/>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{item.items.map((subItem) => (
												<SidebarMenuSubItem
													key={subItem.title}
												>
													<SidebarMenuSubButton
														isActive={
															path ===
															getHref(subItem.url)
														}
														render={
															<Link
																href={getHref(
																	subItem.url,
																)}
															/>
														}
													>
														<span>
															{subItem.title}
														</span>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</CollapsibleContent>
								</SidebarMenuItem>
							</Collapsible>
						) : (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									isActive={path === getHref(item.url)}
									render={<Link href={getHref(item.url)} />}
								>
									<HugeiconsIcon icon={item.icon} size={16} />
									<span>{item.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						),
					)}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}
