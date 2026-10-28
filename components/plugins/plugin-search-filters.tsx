'use client'

import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useTransition } from 'react'
import {
	ActiveListingFilter,
	ListingFilters,
	type ListingOption,
	ListingSelect,
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
			software: parseAsString.withDefault(''),
			category: parseAsString.withDefault(''),
			sort: parseAsStringLiteral([
				'latest',
				'rating',
			] as const).withDefault('latest'),
			cursor: parseAsString,
		},
		{ history: 'replace', shallow: false, scroll: false, startTransition },
	)
	const softwareValue = software.some(
		(option) => option.value === filters.software,
	)
		? filters.software
		: ''
	const categoryValue = categories.some(
		(option) => option.value === filters.category,
	)
		? filters.category
		: ''
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
						filters.software ||
						filters.category ||
						filters.sort !== 'latest'
					)
				}
				disabled={pending}
				onClear={() =>
					update({
						q: '',
						software: '',
						category: '',
						sort: 'latest',
					})
				}
			>
				<ListingSelect
					label="Categories"
					onChange={(category) =>
						update({ category: category === 'all' ? '' : category })
					}
					options={[
						{ value: 'all', label: 'All categories' },
						...categories,
					]}
					value={categoryValue || 'all'}
				/>
				<ListingSelect
					label="Server software"
					onChange={(software) =>
						update({ software: software === 'all' ? '' : software })
					}
					options={[
						{ value: 'all', label: 'Any software' },
						...software,
					]}
					value={softwareValue || 'all'}
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
			{softwareValue || categoryValue ? (
				<fieldset
					aria-label="Active filters"
					className="flex min-w-0 flex-wrap gap-2"
				>
					{softwareValue ? (
						<ActiveListingFilter
							label={
								software.find(
									(option) => option.value === softwareValue,
								)?.label ?? softwareValue
							}
							onRemove={() => update({ software: '' })}
						/>
					) : null}
					{categoryValue ? (
						<ActiveListingFilter
							label={
								categories.find(
									(option) => option.value === categoryValue,
								)?.label ?? categoryValue
							}
							onRemove={() => update({ category: '' })}
						/>
					) : null}
				</fieldset>
			) : null}
			<span aria-live="polite" className="sr-only">
				{pending ? 'Updating plugin results' : ''}
			</span>
		</div>
	)
}
