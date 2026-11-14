'use client'

import { UserCheck01Icon } from '@hugeicons/core-free-icons'
import { usePaginatedQuery } from 'convex/react'
import { useState } from 'react'
import { FilterChips, PagedList } from '@/components/social/paged-list'
import {
	FollowButton,
	type FollowTargetType,
} from '@/components/social/social-buttons'
import { TargetRow } from '@/components/social/target-row'
import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { api } from '@/convex/_generated/api'

const PAGE_SIZE = 24

type Filter = 'all' | FollowTargetType

const FILTERS: { value: Filter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'user', label: 'Creators' },
	{ value: 'organization', label: 'Organizations' },
	{ value: 'project', label: 'Add-ons and packs' },
	{ value: 'plugin', label: 'Plugins' },
	{ value: 'server', label: 'Servers' },
	{ value: 'collection', label: 'Collections' },
]

export default function FollowingPage() {
	const [filter, setFilter] = useState<Filter>('all')
	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.social.follows.listMine,
		filter === 'all' ? {} : { targetType: filter },
		{ initialNumItems: PAGE_SIZE },
	)
	const items = results.filter((item) => item !== null)

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				description="You hear about new releases and listings from everything you follow. Follows are public and help others find good work."
				title="Following"
			/>
			<FilterChips
				label="Show"
				onChange={setFilter}
				options={FILTERS}
				value={filter}
			/>
			<PagedList
				empty={{
					icon: UserCheck01Icon,
					title: 'Not following anything yet',
					description:
						'Follow creators, organizations, listings and collections to get notified about new releases.',
				}}
				items={items}
				loadMore={loadMore}
				pageSize={PAGE_SIZE}
				renderItem={(item) => (
					<TargetRow
						actions={
							<FollowButton
								showCount={false}
								size="sm"
								targetId={item.targetId}
								targetType={item.targetType}
							/>
						}
						key={`${item.targetType}:${item.targetId}`}
						summary={item}
					/>
				)}
				status={status}
			/>
		</div>
	)
}
