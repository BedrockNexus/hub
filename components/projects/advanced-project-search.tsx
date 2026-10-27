'use client'

import {
	Cancel01Icon,
	FilterIcon,
	SearchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import {
	EMPTY_PROJECT_TYPE_FILTERS,
	hasProjectTypeFilters,
	type ProjectTypeFilterValues,
	ProjectTypeSearchFilters,
} from '@/components/projects/project-type-search-filters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '@/components/ui/input-group'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
	/** A Minecraft version, or an empty string for any. */
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

interface AdvancedProjectSearchProps {
	contentType: ProjectType
	filters: ProjectSearchFilters
	onFiltersChange: (filters: ProjectSearchFilters) => void
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

const ANY_VERSION = 'any'

function newestVersionFirst(a: string, b: string) {
	return b.localeCompare(a, undefined, { numeric: true })
}

export function AdvancedProjectSearch({
	contentType,
	filters,
	onFiltersChange,
}: AdvancedProjectSearchProps) {
	const categories = useQuery(api.functions.projects.categories.list, {
		projectType: filters.type === 'all' ? undefined : filters.type,
	})
	const gameVersions = useQuery(
		api.functions.site.gameVersions.listActive,
		{},
	)

	const [searchInput, setSearchInput] = useState(filters.query)
	const [tagInput, setTagInput] = useState('')
	const [categoryOpen, setCategoryOpen] = useState(false)

	useEffect(() => {
		setSearchInput(filters.query)
	}, [filters.query])

	// Debounced search
	useEffect(() => {
		const timer = setTimeout(() => {
			if (searchInput !== filters.query) {
				onFiltersChange({ ...filters, query: searchInput })
			}
		}, 300)
		return () => clearTimeout(timer)
	}, [searchInput, filters, onFiltersChange])

	const updateFilter = <K extends keyof ProjectSearchFilters>(
		key: K,
		value: ProjectSearchFilters[K],
	) => {
		onFiltersChange({ ...filters, [key]: value })
	}
	const updateTypeFilter = <K extends keyof ProjectTypeFilterValues>(
		key: K,
		value: ProjectTypeFilterValues[K],
	) => {
		onFiltersChange({ ...filters, [key]: value })
	}

	const toggleCategory = (categoryId: Id<'projectCategories'>) => {
		const newCategories = filters.categoryIds.includes(categoryId)
			? filters.categoryIds.filter((id) => id !== categoryId)
			: [...filters.categoryIds, categoryId]
		updateFilter('categoryIds', newCategories)
	}

	const addTag = () => {
		const tag = normalizeTag(tagInput)
		setTagInput('')
		if (
			tag &&
			!filters.tags.includes(tag) &&
			filters.tags.length < MAX_TAG_FILTERS
		) {
			updateFilter('tags', [...filters.tags, tag])
		}
	}

	const clearFilters = () => {
		setSearchInput('')
		setTagInput('')
		onFiltersChange({ ...EMPTY_PROJECT_FILTERS, type: contentType })
	}

	const hasActiveFilters =
		filters.query ||
		filters.categoryIds.length > 0 ||
		filters.gameVersion ||
		filters.tags.length > 0 ||
		filters.updated !== 'any' ||
		hasProjectTypeFilters(filters)

	const selectedCategories = categories?.filter((c) =>
		filters.categoryIds.includes(c._id),
	)
	const versionOptions = (gameVersions ?? [])
		.map((item) => item.version)
		.sort(newestVersionFirst)
	// Search results come back by relevance, so the sort has no effect there.
	const isSearching = filters.query.trim() !== ''

	return (
		<div className="space-y-4">
			{/* Search bar */}
			<InputGroup>
				<InputGroupAddon>
					<HugeiconsIcon icon={SearchIcon} />
				</InputGroupAddon>
				<InputGroupInput
					aria-label={`Search ${PROJECT_TYPE_PLURAL_LABELS[contentType].toLowerCase()}`}
					onChange={(e) => setSearchInput(e.target.value)}
					placeholder={`Search ${PROJECT_TYPE_PLURAL_LABELS[contentType].toLowerCase()}...`}
					value={searchInput}
				/>
				{searchInput && (
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							aria-label="Clear search"
							onClick={() => {
								setSearchInput('')
								updateFilter('query', '')
							}}
							size="icon-sm"
						>
							<HugeiconsIcon icon={Cancel01Icon} />
						</InputGroupButton>
					</InputGroupAddon>
				)}
			</InputGroup>

			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
				<ProjectTypeSearchFilters
					filters={filters}
					onChange={updateTypeFilter}
					type={filters.type}
				/>

				{/* Categories */}
				<Popover onOpenChange={setCategoryOpen} open={categoryOpen}>
					<PopoverTrigger
						render={
							<Button
								className="w-full justify-start sm:w-auto"
								variant="outline"
							/>
						}
					>
						<HugeiconsIcon icon={FilterIcon} />
						Categories
						{filters.categoryIds.length > 0 && (
							<Badge className="ml-1 px-1.5" variant="secondary">
								{filters.categoryIds.length}
							</Badge>
						)}
					</PopoverTrigger>
					<PopoverContent align="start" className="w-64 p-0">
						<Command>
							<CommandInput placeholder="Search categories..." />
							<CommandList>
								<CommandEmpty>
									No categories found.
								</CommandEmpty>
								<CommandGroup>
									{categories?.map((category) => (
										<CommandItem
											className="gap-2"
											key={category._id}
											onSelect={() =>
												toggleCategory(category._id)
											}
										>
											<Checkbox
												checked={filters.categoryIds.includes(
													category._id,
												)}
												className="pointer-events-none"
											/>
											{category.name}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Minecraft version */}
				<Select
					onValueChange={(value) =>
						updateFilter(
							'gameVersion',
							value === ANY_VERSION ? '' : (value as string),
						)
					}
					value={filters.gameVersion || ANY_VERSION}
				>
					<SelectTrigger
						aria-label="Minecraft version"
						className="w-full sm:w-auto"
					>
						<SelectValue>
							{filters.gameVersion
								? `Minecraft ${filters.gameVersion}`
								: 'Any version'}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ANY_VERSION}>Any version</SelectItem>
						{versionOptions.map((version) => (
							<SelectItem key={version} value={version}>
								{version}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Last updated */}
				<Select
					onValueChange={(value) =>
						updateFilter('updated', value as ProjectUpdatedFilter)
					}
					value={filters.updated}
				>
					<SelectTrigger
						aria-label="Last updated"
						className="w-full sm:w-auto"
					>
						<SelectValue>
							{
								updatedOptions.find(
									(option) =>
										option.value === filters.updated,
								)?.label
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{updatedOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Tags */}
				<form
					className="w-full sm:w-40"
					onSubmit={(event) => {
						event.preventDefault()
						addTag()
					}}
				>
					<InputGroup>
						<InputGroupInput
							aria-label="Filter by tag"
							disabled={filters.tags.length >= MAX_TAG_FILTERS}
							onChange={(e) => setTagInput(e.target.value)}
							placeholder="Add a tag..."
							value={tagInput}
						/>
					</InputGroup>
				</form>

				<Separator className="hidden sm:block" orientation="vertical" />

				{/* Sort */}
				<Select
					disabled={isSearching}
					onValueChange={(value) =>
						updateFilter('sort', value as ProjectSortOption)
					}
					value={filters.sort}
				>
					<SelectTrigger
						aria-label="Sort by"
						className="w-full sm:w-auto"
					>
						<SelectValue>
							{isSearching
								? 'Best match'
								: (sortOptions.find(
										(o) => o.value === filters.sort,
									)?.label ?? 'Sort by')}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{sortOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Clear filters */}
				{hasActiveFilters && (
					<Button
						className="col-span-2 h-9 justify-center text-muted-foreground sm:col-span-1"
						onClick={clearFilters}
						size="sm"
						variant="ghost"
					>
						<HugeiconsIcon
							className="mr-1 size-4"
							icon={Cancel01Icon}
						/>
						Clear
					</Button>
				)}
			</div>

			{/* Active category and tag badges */}
			{((selectedCategories && selectedCategories.length > 0) ||
				filters.tags.length > 0) && (
				<div className="flex flex-wrap gap-2">
					{selectedCategories?.map((category) => (
						<Badge
							className="gap-1 pr-1"
							key={category._id}
							variant="secondary"
						>
							{category.name}
							<Button
								aria-label={`Remove ${category.name} filter`}
								className="size-4 hover:bg-transparent"
								onClick={() => toggleCategory(category._id)}
								size="icon"
								variant="ghost"
							>
								<HugeiconsIcon
									className="size-3"
									icon={Cancel01Icon}
								/>
							</Button>
						</Badge>
					))}
					{filters.tags.map((tag) => (
						<Badge
							className="gap-1 pr-1"
							key={tag}
							variant="outline"
						>
							#{tag}
							<Button
								aria-label={`Remove ${tag} tag filter`}
								className="size-4 hover:bg-transparent"
								onClick={() =>
									updateFilter(
										'tags',
										filters.tags.filter(
											(item) => item !== tag,
										),
									)
								}
								size="icon"
								variant="ghost"
							>
								<HugeiconsIcon
									className="size-3"
									icon={Cancel01Icon}
								/>
							</Button>
						</Badge>
					))}
				</div>
			)}
		</div>
	)
}
