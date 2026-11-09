import {
	ArrowRight02Icon,
	Package01Icon,
	PaintBrush01Icon,
	PlugSocketIcon,
	ServerStack01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { getSiteStats } from '@/lib/site-settings'
import { cn } from '@/lib/utils'

/** Big, colour-coded entry points to each section of the site. */
export async function CategoryTiles({
	pluginsEnabled = false,
}: {
	pluginsEnabled?: boolean
}) {
	const stats = await getSiteStats()
	const tiles = [
		{
			href: '/servers',
			title: 'Servers',
			body: 'Survival, PvP, skyblock and minigames, with live status.',
			meta: `${stats.servers.toLocaleString()} listed`,
			icon: ServerStack01Icon,
			tone: 'tile-grass',
		},
		{
			href: '/addons',
			title: 'Addons',
			body: 'New mobs, items, blocks and mechanics for your worlds.',
			meta: 'Reviewed releases',
			icon: Package01Icon,
			tone: 'tile-diamond',
		},
		{
			href: '/resource-packs',
			title: 'Resource packs',
			body: 'Textures, sounds and interfaces that restyle the game.',
			meta: 'Reviewed releases',
			icon: PaintBrush01Icon,
			tone: 'tile-amethyst',
		},
		...(pluginsEnabled
			? [
					{
						href: '/plugins',
						title: 'Plugins',
						body: 'Features for Bedrock server software, built from public source.',
						meta: `${stats.plugins.toLocaleString()} published`,
						icon: PlugSocketIcon,
						tone: 'tile-redstone',
					},
				]
			: []),
	]

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-16 md:px-6">
			<div className="flex flex-col gap-2">
				<p className="eyebrow-block">Categories</p>
				<h2 className="font-bold text-[clamp(1.5rem,2.6vw,2rem)] leading-tight tracking-[-0.015em]">
					What are you looking for?
				</h2>
			</div>
			<ul
				className={cn(
					'grid gap-3 sm:grid-cols-2',
					tiles.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
				)}
			>
				{tiles.map((tile) => (
					<li key={tile.href}>
						<Link
							className={cn(
								'tile-category card-lift group relative isolate flex h-full min-h-48 flex-col gap-3 overflow-hidden rounded-lg border p-5',
								tile.tone,
							)}
							href={tile.href}
						>
							<HugeiconsIcon
								aria-hidden
								className="absolute -right-6 -bottom-6 -z-10 size-36 rotate-[-12deg] text-(--tile) opacity-15 transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110"
								icon={tile.icon}
								strokeWidth={1.5}
							/>
							<span className="tile-bevel grid size-11 place-items-center rounded-md bg-(--tile) text-black/80">
								<HugeiconsIcon
									aria-hidden
									className="size-5.5"
									icon={tile.icon}
									strokeWidth={2}
								/>
							</span>
							<span className="flex flex-col gap-1">
								<span className="font-bold font-display text-xl">
									{tile.title}
								</span>
								<span className="text-muted-foreground text-sm leading-relaxed">
									{tile.body}
								</span>
							</span>
							<span className="mt-auto flex items-center justify-between gap-2 pt-2 font-mono text-muted-foreground text-xs">
								{tile.meta}
								<HugeiconsIcon
									aria-hidden
									className="size-4 text-foreground transition-transform group-hover:translate-x-1"
									icon={ArrowRight02Icon}
								/>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}
