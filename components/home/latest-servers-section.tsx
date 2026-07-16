'use client'

import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
	ServerCard,
	ServerCardSkeleton,
} from '@/components/servers/server-card'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'

export function LatestServersSection() {
	const result = useQuery(api.functions.servers.servers.searchAdvanced, {
		sort: 'newest',
		limit: 6,
	})

	let content: ReactNode
	if (result === undefined) {
		content = (
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{[
					'latest-1',
					'latest-2',
					'latest-3',
					'latest-4',
					'latest-5',
					'latest-6',
				].map((id) => (
					<ServerCardSkeleton key={id} />
				))}
			</div>
		)
	} else if (result.servers.length === 0) {
		content = (
			<div className="border-border border-y py-14 text-center">
				<p className="font-medium">No published servers yet</p>
				<p className="mt-1 text-muted-foreground text-sm">
					The first community listings will appear here.
				</p>
			</div>
		)
	} else {
		content = (
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{result.servers.map((server) => (
					<ServerCard key={server._id} server={server} />
				))}
			</div>
		)
	}

	return (
		<section className="py-16 sm:py-24">
			<div className="container mx-auto px-4 md:px-6">
				<div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="mb-2 font-semibold text-primary text-sm">
							New places to play
						</p>
						<h2 className="font-bold text-3xl tracking-normal md:text-4xl">
							Latest Servers
						</h2>
						<p className="mt-2 max-w-xl text-muted-foreground">
							Explore recently published communities, from
							survival worlds to competitive networks.
						</p>
					</div>
					<Link className="shrink-0" href="/servers?sort=newest">
						<Button variant="outline">
							View All Servers
							<HugeiconsIcon
								className="ml-1 size-4"
								icon={ArrowRight02Icon}
							/>
						</Button>
					</Link>
				</div>

				{content}
			</div>
		</section>
	)
}
