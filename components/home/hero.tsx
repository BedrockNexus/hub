import { CubeIcon, PulseIcon, UserGroupIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { HeroSearch } from '@/components/home/hero-search'
import { getSiteStats } from '@/lib/site-settings'

export interface HeroCategory {
	name: string
	slug: string
}

export function Hero({ categories }: { categories: HeroCategory[] }) {
	const chips = [
		...categories.map((category) => ({
			href: `/servers?category=${encodeURIComponent(category.slug)}`,
			label: category.name,
		})),
		{ href: '/projects?type=addon', label: 'Addons' },
		{ href: '/projects?type=resource_pack', label: 'Resource packs' },
	]

	return (
		<section className="border-b">
			<div className="container mx-auto flex flex-col items-center gap-5 px-4 pt-10 pb-12 text-center sm:pt-12 md:px-6">
				<Image
					alt="Bedrock Nexus"
					className="h-auto w-full max-w-120"
					height={802}
					priority
					sizes="(max-width: 640px) 92vw, 480px"
					src="/images/bedrocknexus-logo.png"
					width={2000}
				/>
				<h1 className="-mt-3 max-w-3xl text-balance font-bold text-[clamp(1.75rem,4vw,2.75rem)] leading-tight">
					Find your next Bedrock server, addon or pack.
				</h1>
				<p className="max-w-xl text-lg text-muted-foreground">
					Verified servers with live status, plus addons and resource
					packs from independent creators.
				</p>
				<div className="mt-1 flex w-full flex-col items-center gap-3">
					<HeroSearch />
					{chips.length > 0 ? (
						<nav
							aria-label="Popular searches"
							className="flex max-w-3xl flex-wrap justify-center gap-2"
						>
							{chips.map((chip) => (
								<Link
									className="inline-flex min-h-10 items-center rounded-sm border border-input bg-card px-3.5 font-medium text-muted-foreground text-sm transition-colors hover:border-ember hover:text-foreground"
									href={chip.href}
									key={chip.href}
								>
									{chip.label}
								</Link>
							))}
						</nav>
					) : null}
				</div>
			</div>
		</section>
	)
}

/** Live totals in a band between the hero and the listings. */
export async function SiteStatsBand() {
	const stats = await getSiteStats()
	const items = [
		{ value: stats.servers, label: 'Servers listed', icon: PulseIcon },
		{
			value: stats.onlinePlayers,
			label: 'Players online now',
			icon: UserGroupIcon,
		},
		{ value: stats.projects, label: 'Projects published', icon: CubeIcon },
	]

	return (
		<section
			aria-label="Bedrock Nexus in numbers"
			className="strata border-ember border-b-[3px]"
		>
			<dl className="container mx-auto grid gap-3 px-4 py-5 sm:grid-cols-3 md:px-6">
				{items.map((item) => (
					<div
						className="flex items-center gap-3.5 rounded-md border border-edge bg-card px-4.5 py-3.5"
						key={item.label}
					>
						<span className="grid size-10 place-items-center rounded-sm bg-muted text-ember-text">
							<HugeiconsIcon
								aria-hidden
								className="size-5"
								icon={item.icon}
							/>
						</span>
						<div className="flex flex-col-reverse">
							<dt className="text-[13px] text-muted-foreground">
								{item.label}
							</dt>
							<dd className="font-mono font-semibold text-2xl tabular-nums">
								{item.value.toLocaleString()}
							</dd>
						</div>
					</div>
				))}
			</dl>
		</section>
	)
}
