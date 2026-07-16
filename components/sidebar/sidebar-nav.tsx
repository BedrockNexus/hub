'use client'

import type { DiscordIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentPropsWithoutRef } from 'react'
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar'

const TRAILING_SLASHES_REGEX = /\/+$/

type HugeIcon = typeof DiscordIcon

export function SidebarNav({
	items,
	groupLabel,
	basePath = '/dashboard',
	...props
}: {
	items: {
		title: string
		url: string
		icon: HugeIcon
		exactMatch?: boolean
	}[]
	groupLabel: string
	basePath?: string
} & ComponentPropsWithoutRef<typeof SidebarGroup>) {
	const path = usePathname()

	const isActive = (url: string, exactMatch?: boolean) => {
		const fullPath = url.startsWith('/')
			? url
			: `${basePath}/${url}`.replace(TRAILING_SLASHES_REGEX, '') ||
				basePath
		if (exactMatch) {
			return path === fullPath
		}
		return path === fullPath || path?.startsWith(`${fullPath}/`)
	}

	const getHref = (url: string) => {
		return url.startsWith('/')
			? url
			: `${basePath}/${url}`.replace(TRAILING_SLASHES_REGEX, '') ||
					basePath
	}

	return (
		<SidebarGroup {...props}>
			<SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								isActive={isActive(item.url, item.exactMatch)}
								render={<Link href={getHref(item.url)} />}
								tooltip={item.title}
							>
								<HugeiconsIcon icon={item.icon} size={16} />
								<span>{item.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}
