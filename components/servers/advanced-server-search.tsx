'use client'

import { useQuery } from 'convex/react'
import {
	ActiveListingFilter,
	ListingChipsCombobox,
	ListingCombobox,
	ListingFilters,
	ListingSort,
} from '@/components/listings/listing-filters'
import { ListingSearch } from '@/components/listings/listing-search'
import { api } from '@/convex/_generated/api'

export const SERVER_SORTS = [
	'players',
	'trending',
	'rating',
	'newest',
	'saved',
] as const
export type SortOption = (typeof SERVER_SORTS)[number]
export const SERVER_STATUSES = ['online', 'offline'] as const
export type ServerStatusFilter = (typeof SERVER_STATUSES)[number]
export interface ServerSearchFilters {
	query: string
	categories: string[]
	regions: string[]
	status: ServerStatusFilter[]
	gameVersions: string[]
	// Only set by links such as /software/[slug]; there is no selector for it.
	software: string | null
	sort: SortOption
}
export const INITIAL_SERVER_FILTERS: ServerSearchFilters = {
	query: '',
	categories: [],
	regions: [],
	status: [],
	gameVersions: [],
	software: null,
	sort: 'players',
}
export const SERVER_SORT_OPTIONS: { value: SortOption; label: string }[] = [
	{ value: 'players', label: 'Most players' },
	{ value: 'trending', label: 'Trending' },
	{ value: 'rating', label: 'Top rated' },
	{ value: 'newest', label: 'Newest' },
	{ value: 'saved', label: 'Most saved' },
]
const STATUS_OPTIONS: { value: ServerStatusFilter; label: string }[] = [
	{ value: 'online', label: 'Online' },
	{ value: 'offline', label: 'Offline' },
]

export function AdvancedServerSearch({
	filters,
	onFiltersChange,
}: {
	filters: ServerSearchFilters
	onFiltersChange: (filters: ServerSearchFilters) => void
}) {
	const categories = useQuery(
		api.functions.servers.categories.listWithCounts,
		{},
	)
	const regions = useQuery(api.functions.servers.servers.getRegions, {})
	const software = useQuery(api.functions.servers.software.listEnabled, {})
	const gameVersions = useQuery(
		api.functions.site.gameVersions.listActive,
		{},
	)
	const versions = (gameVersions ?? [])
		.map((item) => item.version)
		.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
	const update = <K extends keyof ServerSearchFilters>(
		key: K,
		value: ServerSearchFilters[K],
	) => onFiltersChange({ ...filters, [key]: value })
	const active = !!(
		filters.query ||
		filters.categories.length ||
		filters.regions.length ||
		filters.status.length ||
		filters.gameVersions.length ||
		filters.software ||
		filters.sort !== 'players'
	)
	return (
		<div className="space-y-3">
			<ListingSearch
				label="Search servers"
				onChange={(value) => update('query', value)}
				value={filters.query}
			/>
			<ListingFilters
				active={active}
				onClear={() => onFiltersChange(INITIAL_SERVER_FILTERS)}
			>
				<ListingChipsCombobox
					label="Categories"
					onChange={(value) => update('categories', value)}
					options={(categories ?? []).map((item) => ({
						value: item.slug,
						label: item.name,
					}))}
					placeholder="Filter by category..."
					values={filters.categories}
				/>
				<ListingCombobox
					label="Minecraft version"
					onChange={(value) => update('gameVersions', value)}
					options={versions.map((value) => ({ value, label: value }))}
					values={filters.gameVersions}
				/>
				<ListingCombobox
					label="Region"
					onChange={(value) => update('regions', value)}
					options={(regions ?? []).map((value) => ({
						value,
						label: value,
					}))}
					values={filters.regions}
				/>
				<ListingCombobox
					label="Status"
					onChange={(value) =>
						update('status', value as ServerStatusFilter[])
					}
					options={STATUS_OPTIONS}
					values={filters.status}
				/>
				<ListingSort
					onChange={(value) => update('sort', value as SortOption)}
					options={SERVER_SORT_OPTIONS}
					searching={filters.query.trim() !== ''}
					value={filters.sort}
				/>
			</ListingFilters>
			{filters.software ? (
				<fieldset
					aria-label="Active filters"
					className="flex min-w-0 flex-wrap gap-2"
				>
					<ActiveListingFilter
						label={
							software?.find(
								(item) => item.slug === filters.software,
							)?.name ?? filters.software
						}
						onRemove={() => update('software', null)}
					/>
				</fieldset>
			) : null}
		</div>
	)
}
