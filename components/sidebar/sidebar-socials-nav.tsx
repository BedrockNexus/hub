import type { DiscordIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import type * as React from 'react'
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar'

export function SidebarSocialsNav({
	items,
	...props
}: {
	items: {
		title: string
		url: string
		icon: typeof DiscordIcon
	}[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								render={
									<Link
										href={item.url}
										rel="noopener noreferrer"
										target="_blank"
									/>
								}
								size="sm"
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
