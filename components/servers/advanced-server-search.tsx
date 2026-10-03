'use client'

import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import { type ReactNode, useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { cn } from '@/lib/utils'

export type SortOption = 'players' | 'rating' | 'newest' | 'name'

export interface ServerSearchFilters {
	query: string
	categoryIds: Id<'serverCategories'>[]
	region: string | null
	onlineOnly: boolean
	verifiedOnly: boolean
	sort: SortOption
}

export const INITIAL_SERVER_FILTERS: ServerSearchFilters = {
	query: '',
	categoryIds: [],
	region: null,
	onlineOnly: false,
	verifiedOnly: false,
	sort: 'players',
}

export const SERVER_SORT_OPTIONS: { value: SortOption; label: string }[] = [
	{ value: 'players', label: 'Most players' },
	{ value: 'rating', label: 'Top rated' },
	{ value: 'newest', label: 'Newest' },
	{ value: 'name', label: 'A-Z' },
]

interface FilterProps {
	filters: ServerSearchFilters
	onFiltersChange: (filters: ServerSearchFilters) => void
}

/** Debounced search field shown in the page header. */
export function ServerSearchField({ filters, onFiltersChange }: FilterProps) {
	const [value, setValue] = useState(filters.query)

	useEffect(() => setValue(filters.query), [filters.query])
	useEffect(() => {
		const timer = setTimeout(() => {
			if (value !== filters.query) {
				onFiltersChange({ ...filters, query: value })
			}
		}, 300)
		return () => clearTimeout(timer)
	}, [value, filters, onFiltersChange])

	return (
		<label className="flex min-h-12 max-w-3xl items-center gap-2.5 rounded-sm border border-input bg-card px-3.5 text-muted-foreground focus-within:border-ring">
			<HugeiconsIcon
				aria-hidden
				className="size-4.5"
				icon={Search01Icon}
			/>
			<span className="sr-only">Search servers</span>
			<input
				className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
				onChange={(event) => setValue(event.target.value)}
				placeholder="Search by server name"
				type="search"
				value={value}
			/>
			{value ? (
				<button
					aria-label="Clear search"
					className="grid size-8 place-items-center rounded-sm hover:bg-accent"
					onClick={() => setValue('')}
					type="button"
				>
					<HugeiconsIcon className="size-4" icon={Cancel01Icon} />
				</button>
			) : null}
		</label>
	)
}

function FilterGroup({
	title,
	children,
}: {
	title: string
	children: ReactNode
}) {
	return (
		<fieldset className="flex flex-col gap-1 border-b pb-4.5 last:border-b-0 last:pb-0">
			<legend className="pb-2.5 font-bold font-display text-[13px] text-muted-foreground uppercase tracking-[0.1em]">
				{title}
			</legend>
			{children}
		</fieldset>
	)
}

/** Filter sidebar: status, gamemode and region. */
export function ServerFilters({ filters, onFiltersChange }: FilterProps) {
	const categories = useQuery(
		api.functions.servers.categories.listWithCounts,
		{},
	)
	const regions = useQuery(api.functions.servers.servers.getRegions, {})

	const update = <K extends keyof ServerSearchFilters>(
		key: K,
		value: ServerSearchFilters[K],
	) => onFiltersChange({ ...filters, [key]: value })

	const toggleCategory = (id: Id<'serverCategories'>) =>
		update(
			'categoryIds',
			filters.categoryIds.includes(id)
				? filters.categoryIds.filter((item) => item !== id)
				: [...filters.categoryIds, id],
		)

	const hasFilters =
		filters.categoryIds.length > 0 ||
		filters.region !== null ||
		filters.onlineOnly ||
		filters.verifiedOnly

	return (
		<aside
			aria-label="Filters"
			className="flex flex-col gap-4.5 self-start rounded-md border bg-card p-5"
		>
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-lg">Filters</h2>
				{hasFilters ? (
					<button
						className="font-semibold text-ember-text text-sm hover:text-foreground"
						onClick={() =>
							onFiltersChange({
								...INITIAL_SERVER_FILTERS,
								query: filters.query,
								sort: filters.sort,
							})
						}
						type="button"
					>
						Reset
					</button>
				) : null}
			</div>

			<FilterGroup title="Status">
				<label
					className="flex min-h-10 cursor-pointer items-center justify-between gap-3"
					htmlFor="filter-online-only"
				>
					Online only
					<Switch
						checked={filters.onlineOnly}
						id="filter-online-only"
						onCheckedChange={(checked) =>
							update('onlineOnly', checked)
						}
					/>
				</label>
				<label
					className="flex min-h-10 cursor-pointer items-center justify-between gap-3"
					htmlFor="filter-verified-only"
				>
					Verified owners only
					<Switch
						checked={filters.verifiedOnly}
						id="filter-verified-only"
						onCheckedChange={(checked) =>
							update('verifiedOnly', checked)
						}
					/>
				</label>
			</FilterGroup>

			<FilterGroup title="Gamemode">
				{(categories ?? []).map((category) => (
					<label
						className="flex min-h-9 cursor-pointer items-center gap-2.5"
						htmlFor={`filter-category-${category._id}`}
						key={category._id}
					>
						<Checkbox
							checked={filters.categoryIds.includes(category._id)}
							id={`filter-category-${category._id}`}
							onCheckedChange={() => toggleCategory(category._id)}
						/>
						<span className="flex-1">{category.name}</span>
						<span className="font-mono text-muted-foreground text-xs">
							{category.serverCount}
						</span>
					</label>
				))}
			</FilterGroup>

			{regions && regions.length > 0 ? (
				<FilterGroup title="Region">
					<Select
						onValueChange={(value) =>
							update(
								'region',
								value === 'all' || !value ? null : value,
							)
						}
						value={filters.region ?? 'all'}
					>
						<SelectTrigger
							aria-label="Region"
							className="h-11 w-full"
						>
							<SelectValue>
								{filters.region ?? 'All regions'}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All regions</SelectItem>
							{regions.map((region) => (
								<SelectItem key={region} value={region}>
									{region}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterGroup>
			) : null}
		</aside>
	)
}

export function ServerSortButtons({ filters, onFiltersChange }: FilterProps) {
	return (
		<fieldset className="flex flex-wrap gap-1.5">
			<legend className="sr-only">Sort servers</legend>
			{SERVER_SORT_OPTIONS.map((option) => {
				const active = filters.sort === option.value
				return (
					<button
						aria-pressed={active}
						className={cn(
							'min-h-10 rounded-sm border px-3.5 font-bold font-display text-sm transition-colors',
							active
								? 'border-edge bg-primary text-primary-foreground'
								: 'bg-card text-muted-foreground hover:text-foreground',
						)}
						key={option.value}
						onClick={() =>
							onFiltersChange({ ...filters, sort: option.value })
						}
						type="button"
					>
						{option.label}
					</button>
				)
			})}
		</fieldset>
	)
}
