'use client'

import { useQuery } from 'convex/react'
import { SectionHeading } from '@/components/home/section-heading'
import {
	ProjectCard,
	ProjectCardSkeleton,
} from '@/components/projects/project-card'
import { api } from '@/convex/_generated/api'

const SKELETONS = ['a', 'b', 'c', 'd', 'e', 'f']

/** A grid of project cards on the home page, in one of the listing's orders. */
export function ProjectListSection({
	title,
	sort,
	count = 6,
	href,
	linkLabel,
	hideWhenEmpty = false,
}: {
	title: string
	sort: 'downloads' | 'trending' | 'updated' | 'newest' | 'rating' | 'saved'
	count?: number
	href: string
	linkLabel: string
	/** For a second project section, so the page does not say "none yet" twice. */
	hideWhenEmpty?: boolean
}) {
	const result = useQuery(api.functions.projects.listing.browse, {
		sort,
		paginationOpts: { cursor: null, numItems: count },
	})
	const isEmpty = result !== undefined && result.page.length === 0
	if (isEmpty && hideWhenEmpty) {
		return null
	}

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-14 pb-6 md:px-6">
			<SectionHeading href={href} linkLabel={linkLabel} title={title} />
			{isEmpty ? (
				<p className="rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground">
					No published projects yet. New addons and resource packs
					will appear here.
				</p>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
					{result === undefined
						? SKELETONS.slice(0, count).map((key) => (
								<ProjectCardSkeleton key={key} />
							))
						: result.page.map((project) => (
								<ProjectCard
									content={project}
									key={project._id}
								/>
							))}
				</div>
			)}
		</section>
	)
}
