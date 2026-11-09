import { UserGroupIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { HeroBackdrop } from '@/components/home/hero-backdrop'
import { HeroSearch } from '@/components/home/hero-search'
import { TrendingPanel } from '@/components/home/trending-panel'
import { pluginsNavigation, publicNavigation } from '@/lib/site'
import { getSiteStats } from '@/lib/site-settings'
import { cn } from '@/lib/utils'

/** Opening section: the pitch, a server search, shortcuts, live totals and the busiest servers. */
export async function Hero({
	pluginsEnabled = false,
}: {
	pluginsEnabled?: boolean
}) {
	const stats = await getSiteStats()
	const totals = [
		{ value: stats.servers, label: 'servers listed' },
		{ value: stats.onlinePlayers, label: 'players online now' },
		{ value: stats.projects, label: 'addons & packs' },
		...(pluginsEnabled
			? [{ value: stats.plugins, label: 'server plugins' }]
			: []),
	]
	const shortcuts = [
		...publicNavigation,
		...(pluginsEnabled ? [pluginsNavigation] : []),
		{ href: '/creators', label: 'Creators', icon: UserGroupIcon },
	]

	return (
		<section className="hero-night relative isolate overflow-hidden">
			<div aria-hidden className="hero-night-sky">
				<span className="hero-moon" />
			</div>
			<div
				aria-hidden
				className="hero-ambient mask-fade-b absolute inset-0 -z-10"
			/>
			<HeroBackdrop pluginsEnabled={pluginsEnabled} />
			<div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 pt-14 pb-20 md:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-20 lg:pb-44">
				<div className="flex flex-col items-start gap-6">
					<p className="eyebrow-block">The Bedrock community hub</p>

					<h1 className="text-balance font-bold text-[clamp(2.75rem,6vw,5rem)] leading-[0.98] tracking-[-0.025em]">
						Find your
						<br />
						<span className="text-primary">next world.</span>
					</h1>

					<p className="max-w-[50ch] text-pretty text-lg text-muted-foreground leading-relaxed">
						Servers with live player counts, plus addons, resource
						packs and plugins from independent creators. Free to
						list, free to publish.
					</p>

					<HeroSearch pluginsEnabled={pluginsEnabled} />

					<nav aria-label="Browse" className="flex flex-wrap gap-2">
						{shortcuts.map((link) => (
							<Link
								className="inline-flex h-10 items-center gap-2 rounded-md border bg-card/70 px-3.5 font-display font-semibold text-sm backdrop-blur transition-colors hover:border-primary/60 hover:text-primary"
								href={link.href}
								key={link.href}
							>
								<HugeiconsIcon
									aria-hidden
									className="size-4 text-primary"
									icon={link.icon}
								/>
								{link.label}
							</Link>
						))}
					</nav>

					<dl
						className={cn(
							'mt-3 grid w-full max-w-xl gap-x-6 gap-y-4 border-t pt-6',
							totals.length === 4
								? 'grid-cols-2 sm:grid-cols-4'
								: 'grid-cols-3',
						)}
					>
						{totals.map((item) => (
							<div
								className="flex flex-col-reverse gap-1"
								key={item.label}
							>
								<dt className="text-muted-foreground text-xs">
									{item.label}
								</dt>
								<dd className="font-bold font-display text-3xl tabular-nums leading-none">
									{item.value.toLocaleString()}
								</dd>
							</div>
						))}
					</dl>
				</div>

				<TrendingPanel pluginsEnabled={pluginsEnabled} />
			</div>
			{/* Rolling plains share their dirt texture and lighting with the layer below. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 bottom-0 -z-10"
			>
				<div className="pixel-ground" />
				<div className="chunk-surface absolute inset-x-0 bottom-0 max-lg:hidden" />
			</div>
		</section>
	)
}
