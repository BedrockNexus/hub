'use client'

import { Badge } from '@/components/ui/badge'

type ContentCategory = { _id: string; name: string } | null

export function ProjectStatsRow(props: { categories: ContentCategory[] }) {
	return (
		<div className="mb-6 flex flex-wrap items-center gap-3 text-sm md:gap-4">
			{props.categories.filter(Boolean).map((category) => (
				<Badge key={category?._id} variant="outline">
					{category?.name}
				</Badge>
			))}
		</div>
	)
}
