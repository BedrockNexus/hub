'use client'

import { SearchIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const TARGETS = [
	{
		href: '/servers',
		label: 'Servers',
		placeholder: 'Skyblock, PvP, a server IP...',
	},
	{
		href: '/addons',
		label: 'Addons',
		placeholder: 'Furniture, mobs, guns...',
	},
	{
		href: '/resource-packs',
		label: 'Resource packs',
		placeholder: 'PvP textures, shaders, UI...',
	},
	{
		href: '/plugins',
		label: 'Plugins',
		placeholder: 'Economy, claims, minigames...',
	},
] as const

/**
 * Search one section at a time: the picker chooses which listing the query
 * opens, with its usual `?q=` search.
 */
export function HeroSearch({
	pluginsEnabled = false,
}: {
	pluginsEnabled?: boolean
}) {
	const targets = TARGETS.filter(
		(target) => pluginsEnabled || target.href !== '/plugins',
	)
	const [href, setHref] = useState<string>(targets[0].href)
	const target = targets.find((item) => item.href === href) ?? targets[0]

	return (
		<search className="w-full max-w-xl">
			<form
				action={target.href}
				className="flex w-full items-center gap-1.5 rounded-lg border bg-card/85 p-1.5 shadow-[0_12px_40px_-24px_rgb(0_0_0/0.6)] backdrop-blur transition-colors focus-within:border-primary/60"
			>
				<Select
					onValueChange={(value) => {
						if (value) {
							setHref(value)
						}
					}}
					value={target.href}
				>
					<SelectTrigger
						aria-label="Search in"
						className="h-11! shrink-0 border-transparent bg-muted pr-2.5 pl-3 font-display font-semibold shadow-none hover:bg-accent dark:bg-muted dark:hover:bg-accent"
					>
						<SelectValue>{target.label}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{targets.map((item) => (
							<SelectItem key={item.href} value={item.href}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<HugeiconsIcon
					aria-hidden
					className="ml-1.5 size-5 shrink-0 text-muted-foreground max-sm:hidden"
					icon={SearchIcon}
				/>
				<label className="sr-only" htmlFor="hero-search">
					Search {target.label.toLowerCase()}
				</label>
				<input
					className="h-11 min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-muted-foreground"
					id="hero-search"
					name="q"
					placeholder={target.placeholder}
					type="search"
				/>
				<button
					className={cn(
						buttonVariants({ size: 'lg' }),
						'h-11 rounded-md px-5',
					)}
					type="submit"
				>
					Search
				</button>
			</form>
		</search>
	)
}
