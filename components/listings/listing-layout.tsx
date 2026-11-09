import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const LISTING_GRID_CLASS =
	'grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4'

/** The block colour each browse section is tinted with, as on the home page. */
export type ListingTone = 'grass' | 'diamond' | 'amethyst' | 'redstone'

const TONE_CLASS: Record<ListingTone, string> = {
	grass: 'tile-grass',
	diamond: 'tile-diamond',
	amethyst: 'tile-amethyst',
	redstone: 'tile-redstone',
}

/**
 * A browse page: a night sky tinted with the section's block colour,
 * standing on a flat strip of grass, then the listing.
 */
export function ListingLayout({
	title,
	description,
	tone,
	children,
}: {
	title: string
	description?: string
	tone?: ListingTone
	children: ReactNode
}) {
	return (
		<main className="flex w-full min-w-0 flex-1 flex-col">
			<header
				className={cn(
					'relative isolate overflow-hidden',
					tone && TONE_CLASS[tone],
				)}
			>
				<div aria-hidden className="hero-night-sky listing-night-sky">
					<span className="hero-moon" />
				</div>
				<div
					aria-hidden
					className={cn(
						'mask-fade-b absolute inset-0 -z-10',
						tone ? 'listing-glow' : 'hero-ambient',
					)}
				/>
				<div className="container mx-auto px-4 pt-10 pb-10 md:px-6 lg:pt-14">
					<div className="flex max-w-2xl flex-col gap-2">
						<h1 className="font-bold text-[clamp(2rem,4vw,2.75rem)] leading-tight tracking-[-0.02em]">
							{title}
						</h1>
						{description ? (
							<p className="text-pretty text-lg text-muted-foreground">
								{description}
							</p>
						) : null}
					</div>
				</div>
				<div aria-hidden className="listing-ground" />
			</header>
			<div className="container mx-auto flex w-full min-w-0 flex-col gap-6 px-4 pb-16 md:px-6">
				{children}
			</div>
		</main>
	)
}
