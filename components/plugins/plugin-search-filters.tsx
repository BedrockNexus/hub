'use client'

import {
	parseAsArrayOf,
	parseAsString,
	parseAsStringLiteral,
	useQueryStates,
} from 'nuqs'
import { useTransition } from 'react'
import {
	ListingChipsCombobox,
	ListingCombobox,
	ListingFilters,
	type ListingOption,
	ListingSort,
} from '@/components/listings/listing-filters'
import { ListingSearch } from '@/components/listings/listing-search'

export function PluginSearchFilters({
	software,
	categories,
}: {
	software: ListingOption[]
	categories: ListingOption[]
}) {
	const [pending, startTransition] = useTransition()
	const [filters, setFilters] = useQueryStates(
		{
			q: parseAsString.withDefault(''),
			software: parseAsArrayOf(parseAsString).withDefault([]),
			category: parseAsArrayOf(parseAsString).withDefault([]),
			sort: parseAsStringLiteral([
				'latest',
				'rating',
			] as const).withDefault('latest'),
			cursor: parseAsString,
		},
		{ history: 'replace', shallow: false, scroll: false, startTransition },
	)
	const known = (options: ListingOption[], values: string[]) =>
		values.filter((value) =>
			options.some((option) => option.value === value),
		)
	const softwareValues = known(software, filters.software)
	const categoryValues = known(categories, filters.category)
	const update = (next: Partial<typeof filters>) =>
		setFilters({ ...next, cursor: null })
	return (
		<div className="space-y-3">
			<ListingSearch
				label="Search plugins"
				maxLength={100}
				onChange={(q) => update({ q })}
				value={filters.q}
			/>
			<ListingFilters
				active={
					!!(
						filters.q ||
						softwareValues.length ||
						categoryValues.length ||
						filters.sort !== 'latest'
					)
				}
				disabled={pending}
				onClear={() =>
					update({
						q: '',
						software: [],
						category: [],
						sort: 'latest',
					})
				}
			>
				<ListingChipsCombobox
					label="Categories"
					onChange={(category) => update({ category })}
					options={categories}
					placeholder="Filter by category..."
					values={categoryValues}
				/>
				<ListingCombobox
					label="Server software"
					onChange={(value) => update({ software: value })}
					options={software}
					values={softwareValues}
				/>
				<ListingSort
					onChange={(sort) =>
						update({ sort: sort as 'latest' | 'rating' })
					}
					options={[
						{ value: 'latest', label: 'Recently updated' },
						{ value: 'rating', label: 'Top rated' },
					]}
					searching={filters.q.trim() !== ''}
					value={filters.sort}
				/>
			</ListingFilters>
			<span aria-live="polite" className="sr-only">
				{pending ? 'Updating plugin results' : ''}
			</span>
		</div>
	)
}
