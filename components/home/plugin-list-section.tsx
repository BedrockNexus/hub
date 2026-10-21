'use client'

import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import Link from 'next/link'
import { SectionHeading } from '@/components/home/section-heading'
import { PluginList } from '@/components/plugins/plugin-card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'

const SKELETONS = ['a', 'b', 'c', 'd', 'e', 'f']

function PluginListBody({
	result,
	count,
}: {
	result:
		| FunctionReturnType<typeof api.functions.plugins.catalog.explore>
		| undefined
	count: number
}) {
	if (result === undefined) {
		return (
			<div className="flex flex-col gap-2">
				{SKELETONS.slice(0, count).map((key) => (
					<Skeleton className="h-20 w-full" key={key} />
				))}
			</div>
		)
	}
	if (result.page.length === 0) {
		return (
			<p className="rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground">
				No plugins published yet.{' '}
				<Link
					className="font-semibold text-ember-text hover:text-foreground"
					href="/dashboard/plugins/new"
				>
					Publish the first one
				</Link>
				.
			</p>
		)
	}
	return <PluginList plugins={result.page} />
}

/** Server plugins on the home page, most downloaded or most recently updated. */
export function PluginListSection({
	title,
	sort,
	count = 6,
	href,
	linkLabel,
}: {
	title: string
	sort: 'downloads' | 'latest'
	count?: number
	href: string
	linkLabel: string
}) {
	const result = useQuery(api.functions.plugins.catalog.explore, {
		sort,
		paginationOpts: { cursor: null, numItems: count },
	})

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-14 pb-6 md:px-6">
			<SectionHeading href={href} linkLabel={linkLabel} title={title} />
			<PluginListBody count={count} result={result} />
		</section>
	)
}
