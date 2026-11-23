import Image from 'next/image'
import type { ReactNode } from 'react'
import { type HeaderStat, HeaderStats } from '@/components/header-stats'

/**
 * The header of a creator's or organization's page: banner, picture, name,
 * links and totals. Totals that are zero are left out, so a new profile does
 * not open on a row of zeros.
 */
export function ProfileHero({
	actions,
	avatar,
	badges,
	bannerUrl,
	bio,
	handle,
	meta,
	name,
	stats,
}: {
	actions?: ReactNode
	/** The picture, about 128px square; the hero frames it. */
	avatar: ReactNode
	badges?: ReactNode
	bannerUrl?: string | null
	bio?: string | null
	handle?: string
	meta?: ReactNode
	name: string
	stats: readonly HeaderStat[]
}) {
	const shownStats = stats.filter((stat) => stat.value > 0)
	return (
		<section className="border-b bg-surface-sunken">
			<div className="relative h-36 overflow-hidden sm:h-48">
				{bannerUrl ? (
					<Image
						alt=""
						className="object-cover"
						fill
						priority
						sizes="100vw"
						src={bannerUrl}
					/>
				) : (
					<div aria-hidden className="strata absolute inset-0" />
				)}
				<div
					aria-hidden
					className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-surface-sunken to-transparent"
				/>
			</div>
			<div className="container relative mx-auto flex flex-col gap-6 px-4 pb-8 md:px-6">
				<div className="flex flex-wrap items-end gap-x-6 gap-y-4">
					<div className="-mt-16 shrink-0 overflow-hidden rounded-xl bg-card shadow-black/40 shadow-lg ring-4 ring-surface-sunken sm:-mt-20">
						{avatar}
					</div>
					<div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-1.5">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<h1 className="text-balance font-bold text-[clamp(2rem,4vw,2.75rem)] leading-none">
								{name}
							</h1>
							{badges}
						</div>
						{handle ? (
							<span className="font-mono text-muted-foreground">
								{handle}
							</span>
						) : null}
					</div>
					{actions ? (
						<div className="flex flex-wrap gap-2">{actions}</div>
					) : null}
				</div>
				{bio || meta ? (
					<div className="flex flex-col gap-3">
						{bio ? (
							<p className="max-w-3xl whitespace-pre-wrap text-[17px] text-muted-foreground leading-relaxed">
								{bio}
							</p>
						) : null}
						{meta ? (
							<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground text-sm">
								{meta}
							</div>
						) : null}
					</div>
				) : null}
				{shownStats.length > 0 ? (
					<HeaderStats stats={shownStats} />
				) : null}
			</div>
		</section>
	)
}

/** A titled group of cards on a profile, with how many it holds. */
export function ProfileSection({
	children,
	count,
	title,
}: {
	children: ReactNode
	count: number
	title: string
}) {
	return (
		<section className="flex flex-col gap-4">
			<h2 className="flex items-baseline gap-2.5 font-bold text-2xl">
				{title}
				<span className="font-mono font-normal text-base text-muted-foreground tabular-nums">
					{count.toLocaleString()}
				</span>
			</h2>
			{children}
		</section>
	)
}
