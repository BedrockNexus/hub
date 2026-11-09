'use client'

import Image from 'next/image'
import { useHeroItems } from '@/components/home/hero-items'

const TILES = 24

/**
 * A dimmed, tilted wall of square tiles, like placed blocks, made from the
 * logos and icons of trending servers, addons, packs and plugins.
 */
export function HeroBackdrop({
	pluginsEnabled = false,
}: {
	pluginsEnabled?: boolean
}) {
	const { items } = useHeroItems(pluginsEnabled)
	const images = items.flatMap((item) => (item.image ? [item.image] : []))
	if (images.length === 0) {
		return null
	}
	const tiles = Array.from(
		{ length: TILES },
		(_, index) => images[(index * 5) % images.length],
	)

	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[62%] overflow-hidden lg:block"
		>
			<div className="absolute -inset-x-12 -inset-y-24 grid rotate-[-9deg] grid-cols-6 content-center gap-3 opacity-35 dark:opacity-25">
				{tiles.map((src, index) => (
					<div
						className="relative aspect-square overflow-hidden rounded-md border border-white/10"
						// Images repeat to fill the wall, so the index is the identity.
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed wall order.
						key={index}
					>
						<Image
							alt=""
							className="object-cover"
							fill
							sizes="120px"
							src={src}
						/>
					</div>
				))}
			</div>
			<div className="absolute inset-0 bg-linear-to-r from-background via-background/75 to-background/20" />
			<div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-background/60" />
		</div>
	)
}
