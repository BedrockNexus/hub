'use client'

import { useQuery } from 'convex/react'
import { SectionHeading } from '@/components/home/section-heading'
import {
	ProjectCard,
	ProjectCardSkeleton,
} from '@/components/projects/project-card'
import { api } from '@/convex/_generated/api'

const SKELETONS = ['a', 'b', 'c']

export function LatestProjectsSection() {
	const result = useQuery(api.functions.projects.projects.searchAdvanced, {
		sort: 'newest',
		limit: 6,
	})

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-12 pb-6 md:px-6">
			<SectionHeading
				href="/projects?sort=newest"
				linkLabel="All projects"
				title="Fresh from creators"
			/>
			{result !== undefined && result.items.length === 0 ? (
				<p className="rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground">
					No published projects yet. New addons and resource packs
					will appear here.
				</p>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
					{result === undefined
						? SKELETONS.map((key) => (
								<ProjectCardSkeleton key={key} />
							))
						: result.items.map((project) => (
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
