'use client'

import { useQuery } from 'convex/react'
import {
	ActiveListingFilter,
	ListingFilters,
	ListingMultiSelect,
	ListingSelect,
	ListingSort,
} from '@/components/listings/listing-filters'
import { ListingSearch } from '@/components/listings/listing-search'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'

export const SERVER_SORTS = [
	'players',
	'trending',
	'rating',
	'newest',
	'saved',
] as const
export type SortOption = (typeof SERVER_SORTS)[number]
export interface ServerSearchFilters {
	query: string
	categories: string[]
	region: string | null
	onlineOnly: boolean
	verifiedOnly: boolean
	software: string | null
	gameVersion: string | null
	minPlayers: number
	sort: SortOption
}
export const INITIAL_SERVER_FILTERS: ServerSearchFilters = {
	query: '',
	categories: [],
	region: null,
	onlineOnly: false,
	verifiedOnly: false,
	software: null,
	gameVersion: null,
	minPlayers: 0,
	sort: 'players',
}
export const SERVER_SORT_OPTIONS: { value: SortOption; label: string }[] = [
	{ value: 'players', label: 'Most players' },
	{ value: 'trending', label: 'Trending' },
	{ value: 'rating', label: 'Top rated' },
	{ value: 'newest', label: 'Newest' },
	{ value: 'saved', label: 'Most saved' },
]
const ANY = 'all'

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
		filters.region ||
		filters.onlineOnly ||
		filters.verifiedOnly ||
		filters.software ||
		filters.gameVersion ||
		filters.minPlayers ||
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
				<ListingMultiSelect
					label="Categories"
					onChange={(value) => update('categories', value)}
					options={(categories ?? []).map((item) => ({
						value: item.slug,
						label: item.name,
					}))}
					values={filters.categories}
				/>
				<ListingSelect
					label="Minecraft version"
					onChange={(value) =>
						update('gameVersion', value === ANY ? null : value)
					}
					options={[
						{ value: ANY, label: 'Any version' },
						...versions.map((value) => ({ value, label: value })),
					]}
					value={filters.gameVersion ?? ANY}
				/>
				<ListingSelect
					label="Server software"
					onChange={(value) =>
						update('software', value === ANY ? null : value)
					}
					options={[
						{ value: ANY, label: 'Any software' },
						...(software ?? []).map((item) => ({
							value: item.slug,
							label: item.name,
						})),
					]}
					value={filters.software ?? ANY}
				/>
				<ListingSelect
					label="Region"
					onChange={(value) =>
						update('region', value === ANY ? null : value)
					}
					options={[
						{ value: ANY, label: 'All regions' },
						...(regions ?? []).map((value) => ({
							value,
							label: value,
						})),
					]}
					value={filters.region ?? ANY}
				/>
				<ListingSelect
					label="Players online"
					onChange={(value) => update('minPlayers', Number(value))}
					options={[0, 10, 50, 100, 500].map((value) => ({
						value: String(value),
						label: value
							? `${value}+ players online`
							: 'Any player count',
					}))}
					value={String(filters.minPlayers)}
				/>
				<Button
					aria-pressed={filters.onlineOnly}
					onClick={() => update('onlineOnly', !filters.onlineOnly)}
					variant={filters.onlineOnly ? 'secondary' : 'outline'}
				>
					Online only
				</Button>
				<Button
					aria-pressed={filters.verifiedOnly}
					className="col-span-2 sm:col-span-1"
					onClick={() =>
						update('verifiedOnly', !filters.verifiedOnly)
					}
					variant={filters.verifiedOnly ? 'secondary' : 'outline'}
				>
					Verified owners only
				</Button>
				<ListingSort
					onChange={(value) => update('sort', value as SortOption)}
					options={SERVER_SORT_OPTIONS}
					searching={filters.query.trim() !== ''}
					value={filters.sort}
				/>
			</ListingFilters>
			{filters.categories.length ? (
				<fieldset
					aria-label="Active filters"
					className="flex min-w-0 flex-wrap gap-2"
				>
					{filters.categories.map((slug) => (
						<ActiveListingFilter
							key={slug}
							label={
								categories?.find((item) => item.slug === slug)
									?.name ?? slug
							}
							onRemove={() =>
								update(
									'categories',
									filters.categories.filter(
										(value) => value !== slug,
									),
								)
							}
						/>
					))}
				</fieldset>
			) : null}
		</div>
	)
}
