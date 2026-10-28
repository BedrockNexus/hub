'use client'

import { FavouriteIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import {
	ProjectCard,
	ProjectCardSkeleton,
} from '@/components/projects/project-card'
import {
	ServerCard,
	ServerCardSkeleton,
} from '@/components/servers/server-card'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { api } from '@/convex/_generated/api'
import {
	normalizeProjectType,
	PROJECT_TYPE_PLURAL_LABELS,
	VISIBLE_PROJECT_TYPES,
} from '@/lib/project-artifacts'

export default function SavedItemsPage() {
	const saved = useQuery(api.functions.site.favourites.listMine, {})
	let content: ReactNode

	if (saved === undefined) {
		content = (
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				<ServerCardSkeleton />
				<ProjectCardSkeleton />
			</div>
		)
	} else if (saved.servers.length === 0 && saved.projects.length === 0) {
		content = (
			<Empty className="border border-dashed py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={FavouriteIcon} />
					</EmptyMedia>
					<EmptyTitle>No saved items yet</EmptyTitle>
					<EmptyDescription>
						Use the favourite button on a server, addon, or resource
						pack to keep it here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	} else {
		content = (
			<div className="space-y-8">
				{saved.servers.length > 0 ? (
					<section className="space-y-3">
						<h2 className="font-semibold text-lg">Servers</h2>
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{saved.servers.map((server) => (
								<ServerCard key={server._id} server={server} />
							))}
						</div>
					</section>
				) : null}
				{VISIBLE_PROJECT_TYPES.map((type) => {
					const items = saved.projects.filter(
						(item) => normalizeProjectType(item.type) === type,
					)
					if (!items.length) {
						return null
					}
					return (
						<section className="space-y-3" key={type}>
							<h2 className="font-semibold text-lg">
								{PROJECT_TYPE_PLURAL_LABELS[type]}
							</h2>
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{items.map((item) => (
									<ProjectCard
										content={item}
										key={item._id}
									/>
								))}
							</div>
						</section>
					)
				})}
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				description="Servers, addons and resource packs you want to return to."
				title="Saved"
			/>

			{content}
		</div>
	)
}
