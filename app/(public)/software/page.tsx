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
		'Browse Minecraft Bedrock server software and the plugins published for each on BedrockNexus.',
	alternates: { canonical: '/software' },
}

export default async function SoftwarePage() {
	const software = await fetchQuery(
		api.functions.plugins.catalog.listSoftware,
		{},
	)

	return (
		<PageShell
			description="The software Bedrock servers run, and the plugins published for each."
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
								<span className="extrude row-span-2 grid size-12 place-items-center rounded-sm border-2 border-edge bg-primary text-primary-foreground">
									<HugeiconsIcon
										aria-hidden="true"
										className="size-5"
										icon={Package01Icon}
									/>
								</span>
								<CardTitle className="col-start-2 text-lg">
									{item.name}
								</CardTitle>
								<CardDescription className="col-start-2 line-clamp-1">
									{item.description}
								</CardDescription>
								{item.adapterId ? (
									<Badge
										className="col-start-3 row-start-1"
										variant="outline"
									>
										{item.projectCount}{' '}
										{item.projectCount === 1
											? 'plugin'
											: 'plugins'}
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
