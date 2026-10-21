import { ArrowRight01Icon, Package01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/page-shell'
import { Badge } from '@/components/ui/badge'
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { api } from '@/convex/_generated/api'

export const metadata: Metadata = {
	title: 'Server software',
	description:
		'The software Minecraft Bedrock servers run, with the servers using each and how many players they have online.',
	alternates: { canonical: '/software' },
}

function plural(count: number, noun: string) {
	return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`
}

export default async function SoftwarePage() {
	const software = await fetchQuery(
		api.functions.servers.software.directory,
		{},
	)

	return (
		<PageShell
			description="The software Bedrock servers run, as declared by their owners."
			title="Server software"
		>
			<div className="grid gap-5 md:grid-cols-2">
				{software.map((item) => (
					<Link
						className="group rounded-md"
						href={`/software/${item.slug}`}
						key={item.slug}
					>
						<Card className="h-full transition-[transform,border-color] group-hover:-translate-y-1 group-hover:border-primary">
							<CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-x-4">
								<span className="extrude row-span-3 grid size-12 place-items-center overflow-hidden rounded-md border-2 border-edge bg-primary text-primary-foreground">
									{item.logoUrl ? (
										// biome-ignore lint/performance/noImgElement: CDN logos are already 256px
										<img
											alt=""
											className="size-full object-cover"
											height={48}
											src={item.logoUrl}
											width={48}
										/>
									) : (
										<HugeiconsIcon
											aria-hidden="true"
											className="size-5"
											icon={Package01Icon}
										/>
									)}
								</span>
								<CardTitle className="col-start-2 text-lg">
									{item.name}
								</CardTitle>
								<CardDescription className="col-start-2 line-clamp-1">
									{item.description}
								</CardDescription>
								<p className="col-start-2 font-mono text-muted-foreground text-xs">
									{plural(item.serverCount, 'server')}
									{item.playersOnline > 0
										? ` · ${plural(item.playersOnline, 'player')} online`
										: ''}
								</p>
								{item.pluginCount > 0 ? (
									<Badge
										className="col-start-3 row-start-1"
										variant="outline"
									>
										{plural(item.pluginCount, 'plugin')}
									</Badge>
								) : null}
								<HugeiconsIcon
									className="col-start-3 row-start-2 size-4 justify-self-end text-muted-foreground transition-transform group-hover:translate-x-1"
									icon={ArrowRight01Icon}
								/>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</PageShell>
	)
}
