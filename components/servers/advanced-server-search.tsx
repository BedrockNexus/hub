'use client'

import {
	Cancel01Icon,
	FilterIcon,
	Location01Icon,
	SearchIcon,
	WifiConnected01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Status } from '@/components/dice-ui/status'
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

export type SortOption = 'newest' | 'name' | 'rating'

export interface ServerSearchFilters {
	query: string
	categoryIds: Id<'serverCategories'>[]
	region: string | null
	statusFilter: 'all' | 'online' | 'offline'
	sort: SortOption
}

interface AdvancedServerSearchProps {
	filters: ServerSearchFilters
	onFiltersChange: (filters: ServerSearchFilters) => void
}

const sortOptions: { value: SortOption; label: string }[] = [
	{ value: 'newest', label: 'Newest' },
	{ value: 'name', label: 'Name (A-Z)' },
	{ value: 'rating', label: 'Top Rated' },
]

export function AdvancedServerSearch({
	filters,
	onFiltersChange,
}: AdvancedServerSearchProps) {
	const categories = useQuery(api.functions.servers.categories.list, {})
	const regions = useQuery(api.functions.servers.servers.getRegions, {})

	const [searchInput, setSearchInput] = useState(filters.query)
	const [categoryOpen, setCategoryOpen] = useState(false)
	const [statusOpen, setStatusOpen] = useState(false)

	// Debounced search
	useEffect(() => {
		const timer = setTimeout(() => {
			if (searchInput !== filters.query) {
				onFiltersChange({ ...filters, query: searchInput })
			}
		}, 300)
		return () => clearTimeout(timer)
	}, [searchInput, filters, onFiltersChange])

	const updateFilter = <K extends keyof ServerSearchFilters>(
		key: K,
		value: ServerSearchFilters[K],
	) => {
		onFiltersChange({ ...filters, [key]: value })
	}

	const toggleCategory = (categoryId: Id<'serverCategories'>) => {
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
			region: null,
			statusFilter: 'all',
			sort: 'rating',
		})
	}

	const hasActiveFilters =
		filters.query ||
		filters.categoryIds.length > 0 ||
		filters.region !== null ||
		filters.statusFilter !== 'all'

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
					placeholder="Search servers..."
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

				<Select
					onValueChange={(value) =>
						updateFilter('region', value === 'all' ? null : value)
					}
					value={filters.region ?? 'all'}
				>
					<SelectTrigger className="w-full sm:w-auto">
						<HugeiconsIcon icon={Location01Icon} />
						<SelectValue>
							{filters.region ?? 'All regions'}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All regions</SelectItem>
						{regions?.map((region) => (
							<SelectItem key={region} value={region}>
								{region}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Status */}
				<Popover onOpenChange={setStatusOpen} open={statusOpen}>
					<PopoverTrigger
						render={
							<Button
								className="w-full justify-start sm:w-auto"
								variant="outline"
							/>
						}
					>
						<HugeiconsIcon icon={WifiConnected01Icon} />
						Status
						{filters.statusFilter !== 'all' && (
							<Status
								className="ml-1"
								variant={
									filters.statusFilter === 'online'
										? 'success'
										: 'error'
								}
							>
								{filters.statusFilter === 'online'
									? 'Online'
									: 'Offline'}
							</Status>
						)}
					</PopoverTrigger>
					<PopoverContent align="start" className="w-40 p-1">
						<div className="flex flex-col gap-0.5">
							<Button
								className="justify-start"
								onClick={() => {
									updateFilter('statusFilter', 'all')
									setStatusOpen(false)
								}}
								variant={
									filters.statusFilter === 'all'
										? 'secondary'
										: 'ghost'
								}
							>
								All Servers
							</Button>
							<Button
								className="justify-start"
								onClick={() => {
									updateFilter('statusFilter', 'online')
									setStatusOpen(false)
								}}
								variant={
									filters.statusFilter === 'online'
										? 'secondary'
										: 'ghost'
								}
							>
								Online Only
							</Button>
							<Button
								className="justify-start"
								onClick={() => {
									updateFilter('statusFilter', 'offline')
									setStatusOpen(false)
								}}
								size="sm"
								variant={
									filters.statusFilter === 'offline'
										? 'secondary'
										: 'ghost'
								}
							>
								Offline Only
							</Button>
						</div>
					</PopoverContent>
				</Popover>

				<Separator className="hidden sm:block" orientation="vertical" />

				{/* Sort */}
				<Select
					onValueChange={(value) =>
						updateFilter('sort', value as SortOption)
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
