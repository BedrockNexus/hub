import {
	ArrowRight02Icon,
	ArrowUpRight01Icon,
	CubeIcon,
	PlugSocketIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { siteConfig } from '@/lib/site'

const LINK_CLASS =
	'inline-flex min-h-11 items-center gap-1.5 font-semibold text-ember-text hover:text-foreground'

const LISTING_STEPS = [
	{
		title: 'Add your address',
		body: 'Name, IP and port, gamemodes and a short pitch.',
	},
	{
		title: 'Prove you own it',
		body: 'A DNS TXT record or a code in your MOTD.',
	},
	{
		title: 'Go live',
		body: 'Live status, player counts and reviews on your page.',
	},
]

export function CreatorsSection() {
	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-14 pb-20 md:px-6">
			<h2 className="font-bold text-[clamp(1.625rem,3vw,2.25rem)] leading-tight">
				Build on Bedrock Nexus
			</h2>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				<div className="flex flex-col gap-6 rounded-md border bg-card p-6 lg:row-span-2 lg:p-8">
					<div className="flex flex-col gap-2">
						<h3 className="font-bold text-2xl">Own a server?</h3>
						<p className="max-w-prose text-muted-foreground">
							Listing is free. Verified owners get a badge and
							their server ranks with live player counts.
						</p>
					</div>
					<ol className="grid gap-4 sm:grid-cols-3">
						{LISTING_STEPS.map((step, index) => (
							<li
								className="flex flex-col gap-2"
								key={step.title}
							>
								<span className="extrude grid size-9 place-items-center rounded-sm border-2 border-edge bg-primary font-bold font-display text-primary-foreground">
									{index + 1}
								</span>
								<span className="font-bold font-display">
									{step.title}
								</span>
								<span className="text-muted-foreground text-sm">
									{step.body}
								</span>
							</li>
						))}
					</ol>
					<Link
						className={buttonVariants({
							variant: 'brand',
							size: 'xl',
							className: 'mt-auto self-start',
						})}
						href="/dashboard/servers/add"
					>
						List your server
					</Link>
				</div>

				<div className="flex gap-4 rounded-md border bg-card p-5">
					<HugeiconsIcon
						aria-hidden
						className="mt-1 size-6 shrink-0 text-ember-text"
						icon={CubeIcon}
					/>
					<div className="flex flex-col gap-1.5">
						<h3 className="font-bold text-lg">
							Publish addons and packs
						</h3>
						<p className="text-muted-foreground text-sm">
							Versioned releases, each one reviewed before it goes
							live.
						</p>
						<Link
							className={LINK_CLASS}
							href="/dashboard/projects/add"
						>
							Publish a project
							<HugeiconsIcon
								aria-hidden
								className="size-4"
								icon={ArrowRight02Icon}
							/>
						</Link>
					</div>
				</div>

				<div className="flex gap-4 rounded-md border bg-card p-5">
					<HugeiconsIcon
						aria-hidden
						className="mt-1 size-6 shrink-0 text-ember-text"
						icon={PlugSocketIcon}
					/>
					<div className="flex flex-col gap-1.5">
						<h3 className="font-bold text-lg">Server plugins</h3>
						<p className="text-muted-foreground text-sm">
							Open-source PHP plugins with traceable GitHub
							builds.
						</p>
						<a
							className={LINK_CLASS}
							href={siteConfig.pluginsUrl}
							rel="noopener"
							target="_blank"
						>
							Browse plugins
							<HugeiconsIcon
								aria-hidden
								className="size-4"
								icon={ArrowUpRight01Icon}
							/>
						</a>
					</div>
				</div>
			</div>
		</section>
	)
}
