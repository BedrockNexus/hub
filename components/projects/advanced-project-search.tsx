'use client'

import { useQuery } from 'convex/react'
import { useState } from 'react'
import {
	ActiveListingFilter,
	ListingFilters,
	ListingMultiSelect,
	ListingSelect,
	ListingSort,
} from '@/components/listings/listing-filters'
import { ListingSearch } from '@/components/listings/listing-search'
import {
	EMPTY_PROJECT_TYPE_FILTERS,
	hasProjectTypeFilters,
	type ProjectTypeFilterValues,
	ProjectTypeSearchFilters,
} from '@/components/projects/project-type-search-filters'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
	PROJECT_TYPE_PLURAL_LABELS,
	type ProjectType,
} from '@/lib/project-artifacts'
import { normalizeTag } from '@/lib/tags'

export const PROJECT_SORTS = [
	'downloads',
	'trending',
	'updated',
	'newest',
	'rating',
	'saved',
] as const
export type ProjectSortOption = (typeof PROJECT_SORTS)[number]
export const PROJECT_UPDATED_FILTERS = [
	'any',
	'week',
	'month',
	'quarter',
	'year',
] as const
export type ProjectUpdatedFilter = (typeof PROJECT_UPDATED_FILTERS)[number]
export const MAX_TAG_FILTERS = 5
export interface ProjectSearchFilters extends ProjectTypeFilterValues {
	query: string
	categoryIds: Id<'projectCategories'>[]
	type: 'all' | ProjectType
	sort: ProjectSortOption
	gameVersion: string
	tags: string[]
	updated: ProjectUpdatedFilter
}
export const EMPTY_PROJECT_FILTERS: ProjectSearchFilters = {
	query: '',
	categoryIds: [],
	type: 'all',
	sort: 'downloads',
	gameVersion: '',
	tags: [],
	updated: 'any',
	...EMPTY_PROJECT_TYPE_FILTERS,
}
const sortOptions: { value: ProjectSortOption; label: string }[] = [
	{ value: 'downloads', label: 'Most downloaded' },
	{ value: 'trending', label: 'Trending' },
	{ value: 'updated', label: 'Recently updated' },
	{ value: 'newest', label: 'Newest' },
	{ value: 'rating', label: 'Top rated' },
	{ value: 'saved', label: 'Most saved' },
]
const updatedOptions: { value: ProjectUpdatedFilter; label: string }[] = [
	{ value: 'any', label: 'Updated any time' },
	{ value: 'week', label: 'Updated this week' },
	{ value: 'month', label: 'Updated this month' },
	{ value: 'quarter', label: 'Updated in 3 months' },
	{ value: 'year', label: 'Updated this year' },
]

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
	const [tagInput, setTagInput] = useState('')
	const update = <K extends keyof ProjectSearchFilters>(
		key: K,
		value: ProjectSearchFilters[K],
	) => onFiltersChange({ ...filters, [key]: value })
	const active = !!(
		filters.query ||
		filters.categoryIds.length ||
		filters.gameVersion ||
		filters.tags.length ||
		filters.updated !== 'any' ||
		filters.sort !== 'downloads' ||
		hasProjectTypeFilters(filters)
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
				onClear={() => {
					setTagInput('')
					onFiltersChange({
						...EMPTY_PROJECT_FILTERS,
						type: contentType,
					})
				}}
			>
				<ListingMultiSelect
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
					values={filters.categoryIds}
				/>
				<ListingSelect
					label="Minecraft version"
					onChange={(value) =>
						update('gameVersion', value === 'any' ? '' : value)
					}
					options={[
						{ value: 'any', label: 'Any version' },
						...versions.map((value) => ({ value, label: value })),
					]}
					value={filters.gameVersion || 'any'}
				/>
				<ProjectTypeSearchFilters
					filters={filters}
					onChange={(key, value) =>
						onFiltersChange({ ...filters, [key]: value })
					}
					type={filters.type}
				/>
				<ListingSelect
					label="Last updated"
					onChange={(value) =>
						update('updated', value as ProjectUpdatedFilter)
					}
					options={updatedOptions}
					value={filters.updated}
				/>
				<form
					className="min-w-0 sm:w-40"
					onSubmit={(event) => {
						event.preventDefault()
						const tag = normalizeTag(tagInput)
						setTagInput('')
						if (
							tag &&
							!filters.tags.includes(tag) &&
							filters.tags.length < MAX_TAG_FILTERS
						) {
							update('tags', [...filters.tags, tag])
						}
					}}
				>
					<InputGroup>
						<InputGroupInput
							aria-label="Filter by tag"
							disabled={filters.tags.length >= MAX_TAG_FILTERS}
							onChange={(event) =>
								setTagInput(event.target.value)
							}
							placeholder="Add a tag..."
							value={tagInput}
						/>
					</InputGroup>
				</form>
				<ListingSort
					onChange={(value) =>
						update('sort', value as ProjectSortOption)
					}
					options={sortOptions}
					searching={filters.query.trim() !== ''}
					value={filters.sort}
				/>
			</ListingFilters>
			{filters.categoryIds.length || filters.tags.length ? (
				<fieldset
					aria-label="Active filters"
					className="flex min-w-0 flex-wrap gap-2"
				>
					{filters.categoryIds.map((id) => (
						<ActiveListingFilter
							key={id}
							label={
								categories?.find(
									(category) => category._id === id,
								)?.name ?? id
							}
							onRemove={() =>
								update(
									'categoryIds',
									filters.categoryIds.filter(
										(value) => value !== id,
									),
								)
							}
						/>
					))}
					{filters.tags.map((tag) => (
						<ActiveListingFilter
							key={tag}
							label={`#${tag}`}
							onRemove={() =>
								update(
									'tags',
									filters.tags.filter(
										(value) => value !== tag,
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
