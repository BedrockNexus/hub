'use client'

import { SearchRemoveIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import { useCallback, useState } from 'react'
import { PublicListingPagination } from '@/components/public-listing-pagination'
import {
	AdvancedServerSearch,
	type ServerSearchFilters,
} from '@/components/servers/advanced-server-search'
import {
	ServerCard,
	ServerCardSkeleton,
} from '@/components/servers/server-card'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'

const PAGE_SIZE = 24

const INITIAL_FILTERS: ServerSearchFilters = {
	query: '',
	categoryIds: [],
	region: null,
	statusFilter: 'all',
	sort: 'rating',
}

const SERVER_SKELETON_KEYS = [
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'11',
	'12',
]

export default function ServersPage() {
	const [filters, setFilters] = useState<ServerSearchFilters>(INITIAL_FILTERS)
	const [cursor, setCursor] = useState<number>(0)

	const handleFiltersChange = useCallback((next: ServerSearchFilters) => {
		setFilters(next)
		setCursor(0)
	}, [])

	const searchResults = useQuery(
		api.functions.servers.servers.searchAdvanced,
		{
			query: filters.query || undefined,
			categoryIds:
				filters.categoryIds.length > 0
					? filters.categoryIds
					: undefined,
			region: filters.region ?? undefined,
			statusFilter:
				filters.statusFilter === 'all'
					? undefined
					: filters.statusFilter,
			sort: filters.sort,
			limit: PAGE_SIZE,
			cursor,
		},
	)

	const isLoading = searchResults === undefined

	const handlePageChange = (nextCursor: number) => {
		setCursor(nextCursor)
		document
			.getElementById('server-results')
			?.scrollIntoView({ block: 'start' })
	}

	const renderResults = () => {
		if (isLoading) {
			return (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{SERVER_SKELETON_KEYS.map((key) => (
						<ServerCardSkeleton key={key} />
					))}
				</div>
			)
		}

		if (searchResults.servers.length === 0) {
			return (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={SearchRemoveIcon} />
						</EmptyMedia>
						<EmptyTitle>No servers found</EmptyTitle>
						<EmptyDescription>
							Try a broader search or remove one of your filters.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							onClick={() => handleFiltersChange(INITIAL_FILTERS)}
							variant="outline"
						>
							Clear all filters
						</Button>
					</EmptyContent>
				</Empty>
			)
		}

		return (
			<>
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{searchResults.servers.map((server) => (
						<ServerCard key={server._id} server={server} />
					))}
				</div>
				<PublicListingPagination
					cursor={cursor}
					hasMore={searchResults.hasMore}
					onPageChange={handlePageChange}
					pageSize={PAGE_SIZE}
					totalCount={searchResults.totalCount}
				/>
			</>
		)
	}

	return (
		<main className="container mx-auto px-4 py-8 sm:py-10">
			<div className="mb-6">
				<AdvancedServerSearch
					filters={filters}
					onFiltersChange={handleFiltersChange}
				/>
			</div>

			<div className="scroll-mt-24" id="server-results">
				<div className="mb-4 min-h-5">
					{!isLoading && searchResults ? (
						<p className="text-muted-foreground text-sm">
							{searchResults.totalCount} server
							{searchResults.totalCount === 1 ? '' : 's'} found
						</p>
					) : (
						<Skeleton className="h-4 w-28" />
					)}
				</div>

				{renderResults()}
			</div>
		</main>
	)
}
