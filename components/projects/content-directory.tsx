'use client'

import { SearchRemoveIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { usePaginatedQuery } from 'convex-helpers/react'
import Link from 'next/link'
import {
	parseAsArrayOf,
	parseAsString,
	parseAsStringLiteral,
	useQueryStates,
} from 'nuqs'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
	LISTING_GRID_CLASS,
	ListingLayout,
} from '@/components/listings/listing-layout'
import {
	AdvancedProjectSearch,
	EMPTY_PROJECT_FILTERS,
	PROJECT_SORTS,
	type ProjectSearchFilters,
} from '@/components/projects/advanced-project-search'
import {
	ProjectCard,
	ProjectCardSkeleton,
} from '@/components/projects/project-card'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { contentDashboard } from '@/lib/content-routes'
import {
	PROJECT_TYPE_LABELS,
	PROJECT_TYPE_PLURAL_LABELS,
	type ProjectType,
} from '@/lib/project-artifacts'
import { RESOURCE_PACK_RESOLUTIONS } from '@/lib/project-metadata'

const PAGE_SIZE = 24

const SKELETON_KEYS = [
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'11',
	'12',
]

// Every filter lives in the URL, so a filtered listing can be shared.
const urlFilters = {
	q: parseAsString.withDefault(''),
	sort: parseAsStringLiteral(PROJECT_SORTS).withDefault('downloads'),
	category: parseAsArrayOf(parseAsString).withDefault([]),
	version: parseAsArrayOf(parseAsString).withDefault([]),
	resolution: parseAsArrayOf(
		parseAsStringLiteral(RESOURCE_PACK_RESOLUTIONS),
	).withDefault([]),
}

function ProjectsDirectory({ type }: { type: ProjectType }) {
	const label = PROJECT_TYPE_LABELS[type]
	const plural = PROJECT_TYPE_PLURAL_LABELS[type]
	const clearFilters = { ...EMPTY_PROJECT_FILTERS, type }
	const [url, setUrl] = useQueryStates(urlFilters, { history: 'replace' })
	// How many results the visitor has asked to see so far.
	const [wanted, setWanted] = useState(PAGE_SIZE)

	const filters: ProjectSearchFilters = useMemo(
		() => ({
			query: url.q,
			type,
			sort: url.sort,
			categoryIds: url.category as ProjectSearchFilters['categoryIds'],
			gameVersions: url.version,
			resolutions: type === 'resource_pack' ? url.resolution : [],
		}),
		[url, type],
	)

	const handleFiltersChange = useCallback(
		(next: ProjectSearchFilters) => {
			setWanted(PAGE_SIZE)
			setUrl({
				q: next.query,
				sort: next.sort,
				category: next.categoryIds,
				version: next.gameVersions,
				resolution: next.resolutions,
			})
		},
		[setUrl],
	)

	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.projects.listing.browse,
		{
			query: filters.query || undefined,
			sort: filters.sort,
			type,
			categoryIds:
				filters.categoryIds.length > 0
					? filters.categoryIds
					: undefined,
			gameVersions:
				filters.gameVersions.length > 0
					? filters.gameVersions
					: undefined,
			resourcePackResolutions:
				filters.resolutions.length > 0
					? filters.resolutions
					: undefined,
		},
		{ initialNumItems: PAGE_SIZE },
	)

	// A load can come back short when filters reject most of what it read,
	// so keep going until the visitor has what they asked for.
	useEffect(() => {
		if (status === 'CanLoadMore' && results.length < wanted) {
			loadMore(PAGE_SIZE)
		}
	}, [status, results.length, wanted, loadMore])

	const isExhausted = status === 'Exhausted'
	const isSearching = !isExhausted && results.length < wanted
	const isLoading = results.length === 0 && !isExhausted

	const renderResults = () => {
		if (isLoading) {
			return (
				<div className={LISTING_GRID_CLASS}>
					{SKELETON_KEYS.map((key) => (
						<ProjectCardSkeleton key={key} />
					))}
				</div>
			)
		}

		if (results.length === 0) {
			return (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={SearchRemoveIcon} />
						</EmptyMedia>
						<EmptyTitle>No {plural.toLowerCase()} found</EmptyTitle>
						<EmptyDescription>
							Try a broader search or remove one of your filters.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							onClick={() => handleFiltersChange(clearFilters)}
							variant="outline"
						>
							Clear all filters
						</Button>
					</EmptyContent>
				</Empty>
			)
		}

		return (
			<>
				<div className={LISTING_GRID_CLASS}>
					{results.map((item) => (
						<ProjectCard content={item} key={item._id} />
					))}
				</div>
				{isExhausted ? null : (
					<div className="mt-8 flex justify-center border-t pt-6">
						<Button
							disabled={isSearching}
							onClick={() =>
								setWanted(results.length + PAGE_SIZE)
							}
							variant="outline"
						>
							{isSearching
								? 'Loading...'
								: `Load more ${plural.toLowerCase()}`}
						</Button>
					</div>
				)}
			</>
		)
	}

	return (
		<ListingLayout
			action={
				<Link
					className={buttonVariants({ variant: 'outline' })}
					href={`${contentDashboard(type)}/add`}
				>
					Publish {type === 'addon' ? 'an' : 'a'}{' '}
					{label.toLowerCase()}
				</Link>
			}
			title={plural}
		>
			<div>
				<AdvancedProjectSearch
					contentType={type}
					filters={filters}
					onFiltersChange={handleFiltersChange}
				/>
			</div>

			<div className="scroll-mt-24" id="project-results">
				<div aria-live="polite" className="mb-4 min-h-5">
					{isLoading ? (
						<Skeleton className="h-4 w-28" />
					) : (
						<p className="text-muted-foreground text-sm">
							{isExhausted
								? `${results.length} ${results.length === 1 ? label.toLowerCase() : plural.toLowerCase()} found`
								: `Showing the first ${results.length} ${plural.toLowerCase()}`}
						</p>
					)}
				</div>

				{renderResults()}
			</div>
		</ListingLayout>
	)
}

export function ContentDirectory({ type }: { type: ProjectType }) {
	return (
		<Suspense>
			<ProjectsDirectory key={type} type={type} />
		</Suspense>
	)
}
