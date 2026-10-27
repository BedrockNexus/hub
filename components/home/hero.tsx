import {
	CubeIcon,
	PlugSocketIcon,
	PulseIcon,
	UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { getSiteStats } from '@/lib/site-settings'
import { cn } from '@/lib/utils'

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
		{ href: '/addons', label: 'Addons' },
		{ href: '/resource-packs', label: 'Resource packs' },
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
					Discover, publish and grow on Minecraft Bedrock.
				</h1>
				<p className="max-w-xl text-lg text-muted-foreground">
					Find servers with live status, and addons and resource packs
					from independent creators. Publishing your own is free.
				</p>
				<div className="mt-1 flex w-full flex-col items-center gap-3">
					{chips.length > 0 ? (
						<nav
							aria-label="Popular categories"
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
export async function SiteStatsBand({
	pluginsEnabled = false,
}: {
	pluginsEnabled?: boolean
}) {
	const stats = await getSiteStats()
	const items = [
		{ value: stats.servers, label: 'Servers listed', icon: PulseIcon },
		{
			value: stats.onlinePlayers,
			label: 'Players online now',
			icon: UserGroupIcon,
		},
		{
			value: stats.projects,
			label: 'Addons & resource packs published',
			icon: CubeIcon,
		},
		...(pluginsEnabled
			? [
					{
						value: stats.plugins,
						label: 'Plugins published',
						icon: PlugSocketIcon,
					},
				]
			: []),
	]

	return (
		<section
			aria-label="Bedrock Nexus in numbers"
			className="strata border-ember border-b-[3px]"
		>
			<dl
				className={cn(
					'container mx-auto grid gap-3 px-4 py-5 sm:grid-cols-3 md:px-6',
					items.length === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
				)}
			>
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
