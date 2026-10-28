'use client'

import {
	Add01Icon,
	CubeIcon,
	PaintBrush01Icon,
	PlugSocketIcon,
	ServerStack03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/convex/_generated/api'
import { MAPS_UI_ENABLED } from '@/lib/maps-feature'

const ITEMS = [
	...(MAPS_UI_ENABLED
		? [
				{
					href: '/dashboard/maps/add',
					label: 'Add a map',
					description: 'Publish a Minecraft Bedrock world',
					icon: CubeIcon,
				},
			]
		: []),
	{
		href: '/dashboard/servers/add',
		label: 'Add a server',
		description: 'List and verify your Bedrock server',
		icon: ServerStack03Icon,
	},
	{
		href: '/dashboard/addons/add',
		label: 'Add an addon',
		description: 'Publish a Minecraft Bedrock addon',
		icon: CubeIcon,
	},
	{
		href: '/dashboard/resource-packs/add',
		label: 'Add a resource pack',
		description: 'Publish a Minecraft Bedrock resource pack',
		icon: PaintBrush01Icon,
	},
]

const PLUGIN_ITEM = {
	href: '/dashboard/plugins/new',
	label: 'Add a plugin',
	description: 'Publish a server plugin from GitHub',
	icon: PlugSocketIcon,
}

/** Header "+" button: the one entry point for adding content. */
export function CreateMenu() {
	// Plugin publishing appears only while the feature is switched on.
	const pluginsEnabled =
		useQuery(api.functions.site.settings.getFeatures, {})
			?.pluginsEnabled === true
	const items = pluginsEnabled ? [...ITEMS, PLUGIN_ITEM] : ITEMS
	const addLabel = pluginsEnabled
		? 'Add a server, addon, resource pack or plugin'
		: 'Add a server, addon or resource pack'

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={
							MAPS_UI_ENABLED ? `${addLabel}, or map` : addLabel
						}
						size="icon-lg"
						variant="brand"
					/>
				}
			>
				<HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72" sideOffset={8}>
				{items.map((item) => (
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
