'use client'

import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import Link from 'next/link'
import { SectionHeading } from '@/components/home/section-heading'
import {
	PLUGIN_GRID_CLASS,
	PluginCardSkeleton,
	PluginGrid,
} from '@/components/plugins/plugin-card'
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
			<div className={PLUGIN_GRID_CLASS}>
				{SKELETONS.slice(0, count).map((key) => (
					<PluginCardSkeleton key={key} />
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
	return <PluginGrid plugins={result.page} />
}

/** The newest server plugins on the home page. */
export function PluginListSection({
	title,
	count = 6,
	href,
	linkLabel,
}: {
	title: string
	count?: number
	href: string
	linkLabel: string
}) {
	const result = useQuery(api.functions.plugins.catalog.explore, {
		sort: 'latest',
		paginationOpts: { cursor: null, numItems: count },
	})

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-14 pb-6 md:px-6">
			<SectionHeading href={href} linkLabel={linkLabel} title={title} />
			<PluginListBody count={count} result={result} />
		</section>
	)
}
