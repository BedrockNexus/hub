import { PlugSocketIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { LISTING_GRID_CLASS } from '@/components/listings/listing-layout'

import { RatingLabel, TagChip } from '@/components/servers/server-bits'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface PublicPluginCard {
	slug: string
	name: string
	summary: string
	iconUrl?: string
	categories: { slug: string; name: string }[]
	ratingAverage: number
	ratingCount: number
	software: { slug: string; name: string }
	latestVersion: { version: string } | null
}

export function PluginAvatar({
	name,
	avatarUrl,
	className,
}: {
	name: string
	avatarUrl?: string
	className?: string
}) {
	return (
		<Avatar className={cn('tile-bevel size-12 bg-stone', className)}>
			{avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
			<AvatarFallback className="bg-stone font-bold font-display text-lg text-white">
				{name.slice(0, 1).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	)
}

/** A plugin in a listing grid, laid out like project and server cards. */
export function PluginCard({ plugin }: { plugin: PublicPluginCard }) {
	const categories = plugin.categories.map((category) => category.name)

	return (
		<article className="relative flex h-full gap-4 rounded-md border bg-card p-4.5 transition-colors focus-within:border-ember hover:border-ember">
			<div className="tile-bevel relative grid size-18 shrink-0 place-items-center overflow-hidden rounded-md bg-stone text-white">
				{plugin.iconUrl ? (
					<Image
						alt=""
						className="object-cover"
						fill
						sizes="72px"
						src={plugin.iconUrl}
					/>
				) : (
					<HugeiconsIcon
						aria-hidden
						className="size-8"
						icon={PlugSocketIcon}
					/>
				)}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<span className="eyebrow text-[11px]">
					{plugin.software.name}
				</span>
				<h3 className="truncate font-bold text-lg leading-tight">
					<Link
						className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
						href={`/plugins/${plugin.slug}` as Route}
					>
						{plugin.name}
					</Link>
				</h3>
				{plugin.summary ? (
					<p className="line-clamp-2 text-muted-foreground text-sm">
						{plugin.summary}
					</p>
				) : null}
				{categories.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{categories.map((tag) => (
							<TagChip key={tag}>{tag}</TagChip>
						))}
					</div>
				) : null}
				<div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[13px] text-muted-foreground">
					<RatingLabel
						averageRating={plugin.ratingAverage}
						reviewCount={plugin.ratingCount}
					/>
					{plugin.latestVersion ? (
						<span className="font-mono">
							v{plugin.latestVersion.version}
						</span>
					) : null}
				</div>
			</div>
		</article>
	)
}

export function PluginCardSkeleton() {
	return (
		<div className="flex gap-4 rounded-md border bg-card p-4.5">
			<Skeleton className="size-18 shrink-0" />
			<div className="flex flex-1 flex-col gap-2">
				<Skeleton className="h-3 w-16" />
				<Skeleton className="h-5 w-2/3" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-1/2" />
			</div>
		</div>
	)
}

export const PLUGIN_GRID_CLASS = LISTING_GRID_CLASS

export function PluginGrid({
	plugins,
}: {
	plugins: readonly PublicPluginCard[]
}) {
	return (
		<div className={PLUGIN_GRID_CLASS}>
			{plugins.map((plugin) => (
				<PluginCard key={plugin.slug} plugin={plugin} />
			))}
		</div>
	)
}
