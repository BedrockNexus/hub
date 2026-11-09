import {
	ArrowRight02Icon,
	CubeIcon,
	PlugSocketIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

const LINK_CLASS =
	"mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary after:absolute after:inset-0 after:content-[''] hover:underline"

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

export function CreatorsSection({
	pluginsEnabled = false,
}: {
	/** The plugins card shows only while the Plugins feature is on. */
	pluginsEnabled?: boolean
}) {
	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-16 pb-24 md:px-6">
			<h2 className="font-bold text-[clamp(1.5rem,2.6vw,2rem)] leading-tight tracking-[-0.015em]">
				Build on Bedrock Nexus
			</h2>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				<div className="relative isolate flex flex-col gap-7 overflow-hidden rounded-lg border bg-card p-6 lg:row-span-2 lg:p-9">
					<div
						aria-hidden
						className="hero-ambient absolute inset-0 -z-10"
					/>
					<div className="flex flex-col gap-2">
						<h3 className="font-bold text-[1.75rem] leading-tight tracking-tight">
							Own a server?
						</h3>
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
								<span className="grid size-9 place-items-center rounded-md bg-primary/15 font-bold font-display text-primary ring-1 ring-primary/30">
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

				<div className="card-lift relative flex gap-4 rounded-lg border bg-card p-6">
					<HugeiconsIcon
						aria-hidden
						className="size-11 shrink-0 rounded-md bg-primary/12 p-2.5 text-primary"
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
							href="/dashboard/addons/add"
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

				{pluginsEnabled ? (
					<div className="card-lift relative flex gap-4 rounded-lg border bg-card p-6">
						<HugeiconsIcon
							aria-hidden
							className="size-11 shrink-0 rounded-md bg-primary/12 p-2.5 text-primary"
							icon={PlugSocketIcon}
						/>
						<div className="flex flex-col gap-1.5">
							<h3 className="font-bold text-lg">
								Server plugins
							</h3>
							<p className="text-muted-foreground text-sm">
								Plugins for Bedrock server software, built from
								public GitHub repositories.
							</p>
							<Link
								className={LINK_CLASS}
								href="/dashboard/plugins/new"
							>
								Publish a plugin
								<HugeiconsIcon
									aria-hidden
									className="size-4"
									icon={ArrowRight02Icon}
								/>
							</Link>
						</div>
					</div>
				) : null}
			</div>
		</section>
	)
}
