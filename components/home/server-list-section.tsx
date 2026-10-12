'use client'

import { useQuery } from 'convex/react'
import { SectionHeading } from '@/components/home/section-heading'
import {
	ServerCard,
	ServerCardSkeleton,
} from '@/components/servers/server-card'
import { api } from '@/convex/_generated/api'

const SKELETONS = ['a', 'b', 'c', 'd']

/** A row of server cards on the home page, in one of the listing's orders. */
export function ServerListSection({
	title,
	sort,
	count = 4,
	href,
	linkLabel,
}: {
	title: string
	sort: 'players' | 'trending' | 'rating' | 'newest' | 'saved'
	count?: number
	href: string
	linkLabel: string
}) {
	const result = useQuery(api.functions.servers.listing.browse, {
		sort,
		paginationOpts: { cursor: null, numItems: count },
	})

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-14 pb-6 md:px-6">
			<SectionHeading href={href} linkLabel={linkLabel} title={title} />
			{result !== undefined && result.page.length === 0 ? (
				<p className="rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground">
					No published servers yet. The first community listings will
					appear here.
				</p>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4.5">
					{result === undefined
						? SKELETONS.slice(0, count).map((key) => (
								<ServerCardSkeleton key={key} />
							))
						: result.page.map((server) => (
								<ServerCard key={server._id} server={server} />
							))}
				</div>
			)}
		</section>
	)
}
