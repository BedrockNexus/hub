'use client'

import {
	Cancel01Icon,
	FilterIcon,
	Package01Icon,
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
	PROJECT_TYPES,
	type ProjectType,
} from '@/lib/project-artifacts'

export type ProjectSortOption = 'newest' | 'name' | 'rating' | 'downloads'

export interface ProjectSearchFilters extends ProjectTypeFilterValues {
	query: string
	categoryIds: Id<'projectCategories'>[]
	type: 'all' | ProjectType
	sort: ProjectSortOption
}

interface AdvancedProjectSearchProps {
	filters: ProjectSearchFilters
	onFiltersChange: (filters: ProjectSearchFilters) => void
}

const sortOptions: { value: ProjectSortOption; label: string }[] = [
	{ value: 'downloads', label: 'Most Downloads' },
	{ value: 'newest', label: 'Newest' },
	{ value: 'name', label: 'Name (A-Z)' },
	{ value: 'rating', label: 'Top Rated' },
]

const typeOptions = PROJECT_TYPES.map((value) => ({
	value,
	label: PROJECT_TYPE_PLURAL_LABELS[value],
}))

export function AdvancedProjectSearch({
	filters,
	onFiltersChange,
}: AdvancedProjectSearchProps) {
	const categories = useQuery(api.functions.projects.categories.list, {
		projectType: filters.type === 'all' ? undefined : filters.type,
	})

	const [searchInput, setSearchInput] = useState(filters.query)
	const [categoryOpen, setCategoryOpen] = useState(false)

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

	const clearFilters = () => {
		setSearchInput('')
		onFiltersChange({
			query: '',
			categoryIds: [],
			type: 'all',
			sort: 'downloads',
			...EMPTY_PROJECT_TYPE_FILTERS,
		})
	}

	const hasActiveFilters =
		filters.query ||
		filters.categoryIds.length > 0 ||
		filters.type !== 'all' ||
		hasProjectTypeFilters(filters)

	const selectedCategories = categories?.filter((c) =>
		filters.categoryIds.includes(c._id),
	)

	return (
		<div className="space-y-4">
			{/* Search bar */}
			<InputGroup>
				<InputGroupAddon>
					<HugeiconsIcon icon={SearchIcon} />
				</InputGroupAddon>
				<InputGroupInput
					onChange={(e) => setSearchInput(e.target.value)}
					placeholder="Search projects..."
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
				<Select
					onValueChange={(value) =>
						onFiltersChange({
							...filters,
							categoryIds: [],
							type: value as ProjectSearchFilters['type'],
							...EMPTY_PROJECT_TYPE_FILTERS,
						})
					}
					value={filters.type}
				>
					<SelectTrigger className="w-full sm:w-auto">
						<HugeiconsIcon icon={Package01Icon} />
						<SelectValue>
							{filters.type === 'all'
								? 'All types'
								: typeOptions.find(
										(option) =>
											option.value === filters.type,
									)?.label}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All types</SelectItem>
						{typeOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

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

				<Separator className="hidden sm:block" orientation="vertical" />

				{/* Sort */}
				<Select
					onValueChange={(value) =>
						updateFilter('sort', value as ProjectSortOption)
					}
					value={filters.sort}
				>
					<SelectTrigger className="w-full sm:w-auto">
						<SelectValue>
							{sortOptions.find((o) => o.value === filters.sort)
								?.label ?? 'Sort by'}
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

			{/* Active category badges */}
			{selectedCategories && selectedCategories.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{selectedCategories.map((category) => (
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
				</div>
			)}
		</div>
	)
}
