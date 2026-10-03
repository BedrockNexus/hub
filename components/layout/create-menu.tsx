'use client'

import {
	Add01Icon,
	CubeIcon,
	ServerStack03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ITEMS = [
	{
		href: '/dashboard/servers/add',
		label: 'Add a server',
		description: 'List and verify your Bedrock server',
		icon: ServerStack03Icon,
	},
	{
		href: '/dashboard/projects/add',
		label: 'Add a project',
		description: 'Publish an addon or resource pack',
		icon: CubeIcon,
	},
]

/** Header "+" button: the one entry point for adding content. */
export function CreateMenu() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label="Add a server or project"
						size="icon-lg"
						variant="brand"
					/>
				}
			>
				<HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72" sideOffset={8}>
				{ITEMS.map((item) => (
					<DropdownMenuItem
						className="items-start gap-3 py-2.5"
						key={item.href}
						render={<Link href={item.href} />}
					>
						<HugeiconsIcon
							className="mt-0.5 size-5 text-ember-text"
							icon={item.icon}
						/>
						<span className="flex flex-col">
							<span className="font-display font-semibold">
								{item.label}
							</span>
							<span className="text-muted-foreground text-xs">
								{item.description}
							</span>
						</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
