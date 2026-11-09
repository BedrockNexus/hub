'use client'

import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'
import {
	HERO_KIND_LABELS,
	HERO_KIND_TONES,
	type HeroItem,
	useHeroItems,
} from '@/components/home/hero-items'
import { LogoTile } from '@/components/servers/server-bits'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const SKELETONS = ['a', 'b', 'c', 'd', 'e', 'f']

/** One trending item: what kind it is, its name and its headline number. */
function TrendingRow({ item }: { item: HeroItem }) {
	return (
		<Link
			className="group flex items-center gap-3.5 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/70 focus-visible:bg-accent/70 focus-visible:outline-none"
			href={item.href as Route}
		>
			<LogoTile name={item.name} size={44} src={item.image} />
			<span className="flex min-w-0 flex-1 flex-col gap-1">
				<span className="truncate font-semibold leading-tight group-hover:text-primary">
					{item.name}
				</span>
				<span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
					<span
						className={cn(
							'inline-flex shrink-0 items-center gap-1.5 font-medium text-foreground/80',
							HERO_KIND_TONES[item.kind],
						)}
					>
						<span className="size-2 rounded-[2px] bg-(--tile)" />
						{HERO_KIND_LABELS[item.kind]}
					</span>
					{item.detail ? (
						<span className="truncate">· {item.detail}</span>
					) : null}
				</span>
			</span>
			<span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[13px] text-muted-foreground tabular-nums">
				{item.kind === 'server' ? (
					<span
						className={cn(
							'size-1.5 rounded-[2px]',
							item.online ? 'bg-online' : 'bg-offline',
						)}
					/>
				) : null}
				{item.metric}
			</span>
		</Link>
	)
}

/** A mix of trending servers, addons, packs and new plugins for the hero. */
export function TrendingPanel({
	pluginsEnabled = false,
}: {
	pluginsEnabled?: boolean
}) {
	const { loading, items } = useHeroItems(pluginsEnabled)

	return (
		<aside
			aria-labelledby="trending-panel-title"
			className="relative rounded-lg border bg-card/85 p-2 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.7)] backdrop-blur"
		>
			<div className="flex items-center justify-between gap-3 px-3.5 pt-3 pb-2.5">
				<h2
					className="font-semibold text-base tracking-tight"
					id="trending-panel-title"
				>
					Trending now
				</h2>
				<Link
					className="inline-flex items-center gap-1 font-medium text-muted-foreground text-sm hover:text-foreground"
					href="/trending"
				>
					See all trending
					<HugeiconsIcon
						aria-hidden
						className="size-3.5"
						icon={ArrowRight02Icon}
					/>
				</Link>
			</div>

			<ol className="flex flex-col gap-1">
				{loading
					? SKELETONS.map((key) => (
							<li key={key}>
								<Skeleton className="h-16 w-full rounded-md" />
							</li>
						))
					: items.map((item) => (
							<li key={item.key}>
								<TrendingRow item={item} />
							</li>
						))}
				{!loading && items.length === 0 ? (
					<li className="px-3.5 py-10 text-center text-muted-foreground text-sm">
						Nothing listed yet.
					</li>
				) : null}
			</ol>

			<div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3.5 py-3 text-sm">
				<span className="text-muted-foreground">
					Made something for Bedrock?
				</span>
				<Link
					className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
					href="/dashboard"
				>
					Share it for free
					<HugeiconsIcon
						aria-hidden
						className="size-3.5"
						icon={ArrowRight02Icon}
					/>
				</Link>
			</div>
		</aside>
	)
}
