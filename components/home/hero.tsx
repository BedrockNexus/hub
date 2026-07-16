import {
	ArrowRight02Icon,
	Package01Icon,
	ServerStack03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { Stat, StatLabel, StatValue } from '@/components/dice-ui/stat'
import { Button } from '@/components/ui/button'
import { getSiteStats } from '@/lib/site-settings'

export async function Hero() {
	const stats = await getSiteStats()

	const statsItems = [
		{
			value: stats.servers.toLocaleString(),
			label: 'Servers',
		},
		{
			value: stats.onlinePlayers.toLocaleString(),
			label: 'Players online',
		},
		{
			value: stats.projects.toLocaleString(),
			label: 'Projects',
		},
	]

	return (
		<section className="overflow-hidden border-b bg-background py-14 sm:py-16">
			<div className="container mx-auto px-4 md:px-6">
				<div className="mx-auto flex max-w-4xl flex-col items-center text-center">
					<h1 className="flex w-full justify-center">
						<span className="sr-only">Bedrock Nexus</span>
						<Image
							alt=""
							className="h-auto w-full max-w-170"
							height={802}
							priority
							sizes="(max-width: 640px) 92vw, 680px"
							src="/images/bedrocknexus-logo.png"
							width={2000}
						/>
					</h1>

					<p className="mt-4 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
						Discover Bedrock communities, maps, addons, resource
						packs, and more, all gathered in one place.
					</p>

					<div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
						<Link href="/servers">
							<Button
								className="w-full gap-2 font-semibold sm:w-auto"
								size="lg"
							>
								<HugeiconsIcon
									className="size-4"
									icon={ServerStack03Icon}
								/>
								Explore Servers
								<HugeiconsIcon
									className="size-4"
									icon={ArrowRight02Icon}
								/>
							</Button>
						</Link>
						<Link href="/projects">
							<Button
								className="w-full gap-2 sm:w-auto"
								size="lg"
								variant="outline"
							>
								<HugeiconsIcon
									className="size-4"
									icon={Package01Icon}
								/>
								Browse Projects
							</Button>
						</Link>
					</div>
				</div>

				<div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
					{statsItems.map((stat) => (
						<Stat
							className="grid-cols-1 gap-1 p-4 text-center shadow-none **:data-[slot=stat-label]:col-span-1 **:data-[slot=stat-value]:col-span-1"
							key={stat.label}
						>
							<StatLabel>{stat.label}</StatLabel>
							<StatValue className="font-bold text-2xl tabular-nums sm:text-3xl">
								{stat.value}
							</StatValue>
						</Stat>
					))}
				</div>
			</div>
		</section>
	)
}
