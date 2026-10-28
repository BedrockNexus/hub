'use client'

import { useQuery } from 'convex/react'
import {
	ListingChipsCombobox,
	ListingCombobox,
	ListingFilters,
	ListingSort,
} from '@/components/listings/listing-filters'
import { ListingSearch } from '@/components/listings/listing-search'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
	PROJECT_TYPE_PLURAL_LABELS,
	type ProjectType,
} from '@/lib/project-artifacts'
import {
	RESOURCE_PACK_RESOLUTIONS,
	type ResourcePackResolution,
} from '@/lib/project-metadata'

export const PROJECT_SORTS = [
	'downloads',
	'trending',
	'updated',
	'newest',
	'rating',
	'saved',
] as const
export type ProjectSortOption = (typeof PROJECT_SORTS)[number]
export interface ProjectSearchFilters {
	query: string
	categoryIds: Id<'projectCategories'>[]
	type: 'all' | ProjectType
	sort: ProjectSortOption
	gameVersions: string[]
	// Resource packs only.
	resolutions: ResourcePackResolution[]
}
export const EMPTY_PROJECT_FILTERS: ProjectSearchFilters = {
	query: '',
	categoryIds: [],
	type: 'all',
	sort: 'downloads',
	gameVersions: [],
	resolutions: [],
}
const sortOptions: { value: ProjectSortOption; label: string }[] = [
	{ value: 'downloads', label: 'Most downloaded' },
	{ value: 'trending', label: 'Trending' },
	{ value: 'updated', label: 'Recently updated' },
	{ value: 'newest', label: 'Newest' },
	{ value: 'rating', label: 'Top rated' },
	{ value: 'saved', label: 'Most saved' },
]
const resolutionOptions = RESOURCE_PACK_RESOLUTIONS.map((value) => ({
	value,
	label: value === 'custom' ? 'Custom' : value,
}))

export function AdvancedProjectSearch({
	contentType,
	filters,
	onFiltersChange,
}: {
	contentType: ProjectType
	filters: ProjectSearchFilters
	onFiltersChange: (filters: ProjectSearchFilters) => void
}) {
	const categories = useQuery(api.functions.projects.categories.list, {
		projectType: filters.type === 'all' ? undefined : filters.type,
	})
	const gameVersions = useQuery(
		api.functions.site.gameVersions.listActive,
		{},
	)
	const update = <K extends keyof ProjectSearchFilters>(
		key: K,
		value: ProjectSearchFilters[K],
	) => onFiltersChange({ ...filters, [key]: value })
	const active = !!(
		filters.query ||
		filters.categoryIds.length ||
		filters.gameVersions.length ||
		filters.resolutions.length ||
		filters.sort !== 'downloads'
	)
	const versions = (gameVersions ?? [])
		.map((item) => item.version)
		.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
	return (
		<div className="space-y-3">
			<ListingSearch
				label={`Search ${PROJECT_TYPE_PLURAL_LABELS[contentType].toLowerCase()}`}
				onChange={(value) => update('query', value)}
				value={filters.query}
			/>
			<ListingFilters
				active={active}
				onClear={() =>
					onFiltersChange({
						...EMPTY_PROJECT_FILTERS,
						type: contentType,
					})
				}
			>
				<ListingChipsCombobox
					label="Categories"
					onChange={(value) =>
						update(
							'categoryIds',
							value as Id<'projectCategories'>[],
						)
					}
					options={(categories ?? []).map((item) => ({
						value: item._id,
						label: item.name,
					}))}
					placeholder="Filter by category..."
					values={filters.categoryIds}
				/>
				<ListingCombobox
					label="Version"
					onChange={(value) => update('gameVersions', value)}
					options={versions.map((value) => ({ value, label: value }))}
					values={filters.gameVersions}
				/>
				{contentType === 'resource_pack' ? (
					<ListingCombobox
						label="Resolution"
						onChange={(value) =>
							update(
								'resolutions',
								value as ResourcePackResolution[],
							)
						}
						options={resolutionOptions}
						values={filters.resolutions}
					/>
				) : null}
				<ListingSort
					onChange={(value) =>
						update('sort', value as ProjectSortOption)
					}
					options={sortOptions}
					searching={filters.query.trim() !== ''}
					value={filters.sort}
				/>
			</ListingFilters>
		</div>
	)
}
