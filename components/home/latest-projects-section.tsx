'use client'

import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
	ProjectCard,
	ProjectCardSkeleton,
} from '@/components/projects/project-card'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'

export function LatestProjectsSection() {
	const result = useQuery(api.functions.projects.projects.searchAdvanced, {
		sort: 'newest',
		limit: 6,
	})

	let content: ReactNode
	if (result === undefined) {
		content = (
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{[
					'project-1',
					'project-2',
					'project-3',
					'project-4',
					'project-5',
					'project-6',
				].map((id) => (
					<ProjectCardSkeleton key={id} />
				))}
			</div>
		)
	} else if (result.items.length === 0) {
		content = (
			<div className="border-border border-y py-14 text-center">
				<p className="font-medium">No published projects yet</p>
				<p className="mt-1 text-muted-foreground text-sm">
					New maps, addons, and packs will appear here.
				</p>
			</div>
		)
	} else {
		content = (
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{result.items.map((project) => (
					<ProjectCard content={project} key={project._id} />
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
							Fresh from creators
						</p>
						<h2 className="font-bold text-3xl tracking-normal md:text-4xl">
							Latest Projects
						</h2>
						<p className="mt-2 max-w-xl text-muted-foreground">
							Discover newly released maps, addons, resource
							packs, and other Bedrock creations.
						</p>
					</div>
					<Link className="shrink-0" href="/projects?sort=newest">
						<Button variant="outline">
							View All Projects
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
