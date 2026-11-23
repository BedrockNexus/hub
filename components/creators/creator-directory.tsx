import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { cn } from '@/lib/utils'

export interface CreatorDirectoryItem {
	slug: string
	name: string
	pictureUrl?: string
	serverCount: number
	projectCount: number
	pluginCount: number
	totalDownloads: number
	avgPlayers7d: number
	followerCount: number
}

// Gold, silver and bronze for the first three places.
const PODIUM = [
	'bg-primary text-primary-foreground',
	'bg-zinc-300 text-zinc-900',
	'bg-amber-700 text-amber-50',
]

function Published({ item }: { item: CreatorDirectoryItem }) {
	const parts = [
		{
			label:
				item.projectCount === 1 ? 'Add-on or pack' : 'Add-ons & packs',
			value: item.projectCount,
		},
		{
			label: item.serverCount === 1 ? 'Server' : 'Servers',
			value: item.serverCount,
		},
		{
			label: item.pluginCount === 1 ? 'Plugin' : 'Plugins',
			value: item.pluginCount,
		},
	].filter((part) => part.value > 0)
	if (parts.length === 0) {
		return null
	}
	return (
		<ul className="flex flex-wrap gap-1.5">
			{parts.map((part) => (
				<li
					className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs"
					key={part.label}
				>
					<span className="font-mono font-semibold text-foreground tabular-nums">
						{part.value.toLocaleString()}
					</span>{' '}
					{part.label}
				</li>
			))}
		</ul>
	)
}

function CardStat({
	label,
	value,
	decimals = false,
}: {
	label: string
	value: number
	decimals?: boolean
}) {
	return (
		<div className="flex flex-col gap-0.5 px-3 py-2.5">
			<dt className="order-2 text-muted-foreground text-xs">{label}</dt>
			<dd
				className={cn(
					'font-mono font-semibold tabular-nums',
					value === 0 && 'text-muted-foreground',
				)}
			>
				{value.toLocaleString('en', {
					maximumFractionDigits: decimals ? 1 : 0,
				})}
			</dd>
		</div>
	)
}

/** Ranked cards for /creators and /organizations. */
export function CreatorDirectory({
	items,
	ownerType,
}: {
	items: CreatorDirectoryItem[]
	ownerType: 'user' | 'organization'
}) {
	if (items.length === 0) {
		return (
			<p className="rounded-lg border border-dashed px-6 py-14 text-center text-muted-foreground">
				{ownerType === 'user'
					? 'No creators have published anything yet.'
					: 'No organizations have published anything yet.'}
			</p>
		)
	}

	return (
		<ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{items.map((item, index) => (
				<li key={item.slug}>
					<Link
						className="card-lift group flex h-full flex-col gap-4 rounded-lg border bg-card p-5 focus-visible:border-primary"
						href={
							ownerType === 'user'
								? `/user/${item.slug}`
								: `/organizations/${item.slug}`
						}
					>
						<div className="flex items-center gap-4">
							<div className="relative shrink-0">
								<UserAvatarImage
									avatarClassName="rounded-lg"
									image={item.pictureUrl}
									size={56}
									username={item.name}
								/>
								<span
									className={cn(
										'absolute -top-2 -left-2 grid h-6 min-w-6 place-items-center rounded-full px-1.5 font-bold font-mono text-[11px] tabular-nums ring-2 ring-card',
										PODIUM[index] ??
											'bg-muted text-muted-foreground',
									)}
								>
									<span className="sr-only">Rank </span>
									{index + 1}
								</span>
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<span className="truncate font-bold font-display text-lg leading-tight">
									{item.name}
								</span>
								<Published item={item} />
							</div>
							<HugeiconsIcon
								aria-hidden
								className="size-5 shrink-0 text-muted-foreground transition-[color,translate] group-hover:translate-x-1 group-hover:text-foreground"
								icon={ArrowRight02Icon}
							/>
						</div>
						<dl className="mt-auto grid grid-cols-3 divide-x rounded-md border bg-surface-sunken/60">
							<CardStat
								label="Downloads"
								value={item.totalDownloads}
							/>
							<CardStat
								decimals
								label="Avg players"
								value={item.avgPlayers7d}
							/>
							<CardStat
								label="Followers"
								value={item.followerCount}
							/>
						</dl>
					</Link>
				</li>
			))}
		</ol>
	)
}

/** The same plain-language note under both directories. */
export function RankingNote() {
	return (
		<p className="mt-8 max-w-2xl text-muted-foreground text-sm">
			Ordered by counted downloads, the average number of players on their
			servers over the last 7 days, and how much they have published.
			Refreshed every hour. Nobody can pay for a position.
		</p>
	)
}
