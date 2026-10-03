'use client'

import { useQuery } from 'convex/react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { PageShell } from '@/components/page-shell'
import { PublicListingPagination } from '@/components/public-listing-pagination'
import {
	INITIAL_SERVER_FILTERS,
	ServerFilters,
	ServerSearchField,
	type ServerSearchFilters,
	ServerSortButtons,
} from '@/components/servers/advanced-server-search'
import { ServerRow, ServerRowSkeleton } from '@/components/servers/server-card'
import { Button, buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'

const PAGE_SIZE = 24
const SKELETONS = ['1', '2', '3', '4', '5', '6']

function ServersDirectory() {
	const params = useSearchParams()
	const [filters, setFilters] = useState<ServerSearchFilters>(() => ({
		...INITIAL_SERVER_FILTERS,
		query: params.get('q') ?? '',
	}))
	const [cursor, setCursor] = useState(0)

	// `?category=<slug>` from the homepage chips and gamemode tiles.
	const categories = useQuery(api.functions.servers.categories.list, {})
	const appliedCategory = useRef(false)
	useEffect(() => {
		const slug = params.get('category')
		if (appliedCategory.current || !slug || !categories) {
			return
		}
		appliedCategory.current = true
		const match = categories.find((category) => category.slug === slug)
		if (match) {
			setFilters((current) => ({ ...current, categoryIds: [match._id] }))
		}
	}, [params, categories])

	const handleFiltersChange = useCallback((next: ServerSearchFilters) => {
		setFilters(next)
		setCursor(0)
	}, [])

	const results = useQuery(api.functions.servers.servers.searchAdvanced, {
		query: filters.query || undefined,
		categoryIds:
			filters.categoryIds.length > 0 ? filters.categoryIds : undefined,
		region: filters.region ?? undefined,
		statusFilter: filters.onlineOnly ? 'online' : undefined,
		verifiedOnly: filters.verifiedOnly || undefined,
		sort: filters.sort,
		limit: PAGE_SIZE,
		cursor,
	})
	const stats = useQuery(api.functions.site.settings.getStats, {})

	const handlePageChange = (next: number) => {
		setCursor(next)
		document
			.getElementById('server-results')
			?.scrollIntoView({ block: 'start' })
	}

	const renderResults = () => {
		if (results === undefined) {
			return SKELETONS.map((key) => <ServerRowSkeleton key={key} />)
		}
		if (results.servers.length === 0) {
			return (
				<div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-14 text-center">
					<h2 className="font-bold text-xl">No servers found</h2>
					<p className="text-muted-foreground">
						Try a broader search or remove one of your filters.
					</p>
					<Button
						onClick={() =>
							handleFiltersChange(INITIAL_SERVER_FILTERS)
						}
						variant="outline"
					>
						Clear all filters
					</Button>
				</div>
			)
		}
		return (
			<>
				{results.servers.map((server, index) => (
					<ServerRow
						key={server._id}
						rank={cursor + index + 1}
						server={server}
					/>
				))}
				<PublicListingPagination
					cursor={cursor}
					hasMore={results.hasMore}
					onPageChange={handlePageChange}
					pageSize={PAGE_SIZE}
					totalCount={results.totalCount}
				/>
			</>
		)
	}

	return (
		<PageShell
			actions={
				<Link
					className={buttonVariants({ variant: 'brand', size: 'xl' })}
					href="/dashboard/servers/add"
				>
					List your server
				</Link>
			}
			breadcrumb={[{ href: '/', label: 'Home' }]}
			description={
				stats
					? `${stats.servers.toLocaleString()} servers, ${stats.onlinePlayers.toLocaleString()} players online right now.`
					: 'Live status checked every few minutes.'
			}
			headerContent={
				<ServerSearchField
					filters={filters}
					onFiltersChange={handleFiltersChange}
				/>
			}
			title="Servers"
		>
			<div className="flex flex-wrap gap-6">
				<div className="w-full lg:w-64">
					<ServerFilters
						filters={filters}
						onFiltersChange={handleFiltersChange}
					/>
				</div>
				<section
					aria-label="Results"
					className="flex min-w-0 flex-[999_1_35rem] scroll-mt-24 flex-col gap-3.5"
					id="server-results"
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p aria-live="polite" className="text-muted-foreground">
							{results ? (
								<>
									<strong className="text-foreground">
										{results.totalCount.toLocaleString()}
									</strong>{' '}
									server{results.totalCount === 1 ? '' : 's'}
								</>
							) : (
								'Loading servers…'
							)}
						</p>
						<ServerSortButtons
							filters={filters}
							onFiltersChange={handleFiltersChange}
						/>
					</div>

					{renderResults()}
				</section>
			</div>
		</PageShell>
	)
}

export default function ServersPage() {
	return (
		<Suspense>
			<ServersDirectory />
		</Suspense>
	)
}
