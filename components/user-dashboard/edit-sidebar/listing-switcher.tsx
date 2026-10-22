'use client'

import { Add01Icon, UnfoldMoreIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar'

export interface SwitcherItem {
	id: string
	name: string
	imageUrl?: string
	subtitle?: string
}

function ItemImage({
	item,
	size,
}: {
	item: Pick<SwitcherItem, 'name' | 'imageUrl'>
	size: number
}) {
	return item.imageUrl ? (
		<Image
			alt=""
			className="shrink-0 rounded-md border object-cover"
			height={size}
			src={item.imageUrl}
			style={{ width: size, height: size }}
			width={size}
		/>
	) : (
		<div
			className="flex shrink-0 items-center justify-center rounded-md border bg-muted font-bold text-xs"
			style={{ width: size, height: size }}
		>
			{item.name.charAt(0).toUpperCase()}
		</div>
	)
}

/**
 * The header of an edit sidebar: the current server, project or plugin, and a
 * menu to jump to another one on the same settings page.
 */
export function ListingSwitcher({
	basePath,
	currentId,
	current,
	items,
	addHref,
	addLabel,
}: {
	/** e.g. `/dashboard/servers`; items live at `${basePath}/${id}`. */
	basePath: string
	currentId: string
	/** Shown while `items` loads, or when the current item is not listed. */
	current?: Omit<SwitcherItem, 'id'>
	items: SwitcherItem[] | undefined
	addHref: string
	addLabel: string
}) {
	const router = useRouter()
	const pathname = usePathname()
	const shown = items?.find((item) => item.id === currentId) ?? current
	if (!shown) {
		return null
	}
	const subPath = pathname.slice(`${basePath}/${currentId}`.length)

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								size="lg"
							/>
						}
					>
						<ItemImage item={shown} size={32} />
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">
								{shown.name}
							</span>
							{shown.subtitle ? (
								<span className="truncate text-muted-foreground text-xs">
									{shown.subtitle}
								</span>
							) : null}
						</div>
						<HugeiconsIcon
							className="text-muted-foreground"
							icon={UnfoldMoreIcon}
							size={16}
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="min-w-56"
						side="bottom"
					>
						{(items ?? []).map((item) => (
							<DropdownMenuItem
								key={item.id}
								onClick={() =>
									router.push(
										`${basePath}/${item.id}${subPath}` as Route,
									)
								}
							>
								<ItemImage item={item} size={24} />
								<span className="truncate">{item.name}</span>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => router.push(addHref as Route)}
						>
							<HugeiconsIcon icon={Add01Icon} size={16} />
							<span>{addLabel}</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
