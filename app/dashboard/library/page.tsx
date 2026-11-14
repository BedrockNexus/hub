'use client'

import { Bookmark02Icon } from '@hugeicons/core-free-icons'
import { usePaginatedQuery } from 'convex/react'
import { useState } from 'react'
import { FilterChips, PagedList } from '@/components/social/paged-list'
import {
	AddToCollectionButton,
	type ListingTargetType,
	SaveButton,
} from '@/components/social/social-buttons'
import { TargetRow } from '@/components/social/target-row'
import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { api } from '@/convex/_generated/api'

const PAGE_SIZE = 24

type Filter = 'all' | ListingTargetType

const FILTERS: { value: Filter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'project', label: 'Add-ons and packs' },
	{ value: 'plugin', label: 'Plugins' },
	{ value: 'server', label: 'Servers' },
]

export default function LibraryPage() {
	const [filter, setFilter] = useState<Filter>('all')
	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.social.library.listMine,
		filter === 'all' ? {} : { targetType: filter },
		{ initialNumItems: PAGE_SIZE },
	)
	const items = results.filter((item) => item !== null)

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				description="Add-ons, resource packs, plugins and servers you saved. Only you can see your library; the BedrockNexus Launcher will install from it."
				title="Library"
			/>
			<FilterChips
				label="Show"
				onChange={setFilter}
				options={FILTERS}
				value={filter}
			/>
			<PagedList
				empty={{
					icon: Bookmark02Icon,
					title: 'Your library is empty',
					description:
						'Use Save on an add-on, resource pack, plugin or server to keep it here.',
				}}
				items={items}
				loadMore={loadMore}
				pageSize={PAGE_SIZE}
				renderItem={(item) => {
					const targetType = item.targetType as ListingTargetType
					return (
						<TargetRow
							actions={
								<>
									<AddToCollectionButton
										size="sm"
										targetId={item.targetId}
										targetType={targetType}
									/>
									<SaveButton
										size="sm"
										targetId={item.targetId}
										targetType={targetType}
									/>
								</>
							}
							key={`${item.targetType}:${item.targetId}`}
							summary={item}
						/>
					)
				}}
				status={status}
			/>
		</div>
	)
}
