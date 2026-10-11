'use client'

import { useQuery } from 'convex/react'
import { usePaginatedQuery } from 'convex-helpers/react'
import Link from 'next/link'
import {
	parseAsArrayOf,
	parseAsBoolean,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
	useQueryStates,
} from 'nuqs'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { PageShell } from '@/components/page-shell'
import {
	INITIAL_SERVER_FILTERS,
	SERVER_SORTS,
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

// Every filter lives in the URL, so a filtered listing can be shared.
// `category` holds gamemode slugs, as the homepage links already do.
const urlFilters = {
	q: parseAsString.withDefault(''),
	sort: parseAsStringLiteral(SERVER_SORTS).withDefault('players'),
	category: parseAsArrayOf(parseAsString).withDefault([]),
	region: parseAsString,
	online: parseAsBoolean.withDefault(false),
	verified: parseAsBoolean.withDefault(false),
	software: parseAsString,
	version: parseAsString,
	players: parseAsInteger.withDefault(0),
}

function ServersDirectory() {
	const [url, setUrl] = useQueryStates(urlFilters, { history: 'replace' })
	// How many results the visitor has asked to see so far.
	const [wanted, setWanted] = useState(PAGE_SIZE)

	const filters: ServerSearchFilters = useMemo(
		() => ({
			query: url.q,
			sort: url.sort,
			categories: url.category,
			region: url.region,
			onlineOnly: url.online,
			verifiedOnly: url.verified,
			software: url.software,
			gameVersion: url.version,
			minPlayers: Math.max(0, url.players),
		}),
		[url],
	)

	const handleFiltersChange = useCallback(
		(next: ServerSearchFilters) => {
			setWanted(PAGE_SIZE)
			setUrl({
				q: next.query,
				sort: next.sort,
				category: next.categories,
				region: next.region,
				online: next.onlineOnly,
				verified: next.verifiedOnly,
				software: next.software,
				version: next.gameVersion,
				players: next.minPlayers,
			})
		},
		[setUrl],
	)

	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.servers.listing.browse,
		{
			query: filters.query || undefined,
			sort: filters.sort,
			categories:
				filters.categories.length > 0 ? filters.categories : undefined,
			region: filters.region ?? undefined,
			onlineOnly: filters.onlineOnly || undefined,
			verifiedOnly: filters.verifiedOnly || undefined,
			software: filters.software ?? undefined,
			gameVersion: filters.gameVersion ?? undefined,
			minPlayers: filters.minPlayers || undefined,
		},
		{ initialNumItems: PAGE_SIZE },
	)
	const stats = useQuery(api.functions.site.settings.getStats, {})

	// A load can come back short when filters reject most of what it read,
	// so keep going until the visitor has what they asked for.
	useEffect(() => {
		if (status === 'CanLoadMore' && results.length < wanted) {
			loadMore(PAGE_SIZE)
		}
	}, [status, results.length, wanted, loadMore])

	const isExhausted = status === 'Exhausted'
	const isSearching = !isExhausted && results.length < wanted
	const isLoading = results.length === 0 && !isExhausted

	const renderResults = () => {
		if (isLoading) {
			return SKELETONS.map((key) => <ServerRowSkeleton key={key} />)
		}
		if (results.length === 0) {
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
				{results.map((server, index) => (
					<ServerRow
						key={server._id}
						rank={index + 1}
						server={server}
					/>
				))}
				{isExhausted ? null : (
					<div className="mt-4 flex justify-center border-t pt-6">
						<Button
							disabled={isSearching}
							onClick={() =>
								setWanted(results.length + PAGE_SIZE)
							}
							variant="outline"
						>
							{isSearching ? 'Loading...' : 'Load more servers'}
						</Button>
					</div>
				)}
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
							{isLoading ? (
								'Loading servers…'
							) : (
								<>
									{isExhausted ? null : 'First '}
									<strong className="text-foreground">
										{results.length.toLocaleString()}
									</strong>{' '}
									server{results.length === 1 ? '' : 's'}
								</>
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
