'use client'

import { useQuery } from 'convex/react'
import { SectionHeading } from '@/components/home/section-heading'
import {
	ServerCard,
	ServerCardSkeleton,
} from '@/components/servers/server-card'
import { api } from '@/convex/_generated/api'

const SKELETONS = ['a', 'b', 'c', 'd']

export function LatestServersSection() {
	const result = useQuery(api.functions.servers.servers.searchAdvanced, {
		sort: 'players',
		limit: 4,
	})

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-16 pb-6 md:px-6">
			<SectionHeading
				href="/servers"
				linkLabel="All servers"
				title="Servers worth joining"
			/>
			{result !== undefined && result.servers.length === 0 ? (
				<p className="rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground">
					No published servers yet. The first community listings will
					appear here.
				</p>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4.5">
					{result === undefined
						? SKELETONS.map((key) => (
								<ServerCardSkeleton key={key} />
							))
						: result.servers.map((server) => (
								<ServerCard key={server._id} server={server} />
							))}
				</div>
			)}
		</section>
	)
}
