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
import { PageShell } from '@/components/page-shell'
import {
	AdvancedProjectSearch,
	EMPTY_PROJECT_FILTERS,
	PROJECT_SORTS,
	PROJECT_UPDATED_FILTERS,
	type ProjectSearchFilters,
	type ProjectUpdatedFilter,
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
import { PROJECT_TYPES } from '@/lib/project-artifacts'
import {
	RESOURCE_PACK_CONTENT_TYPES,
	RESOURCE_PACK_RESOLUTIONS,
} from '@/lib/project-metadata'

const PAGE_SIZE = 24
const DAY_MS = 24 * 60 * 60 * 1000

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
	type: parseAsStringLiteral(PROJECT_TYPES),
	sort: parseAsStringLiteral(PROJECT_SORTS).withDefault('downloads'),
	category: parseAsArrayOf(parseAsString).withDefault([]),
	version: parseAsString.withDefault(''),
	tag: parseAsArrayOf(parseAsString).withDefault([]),
	updated: parseAsStringLiteral(PROJECT_UPDATED_FILTERS).withDefault('any'),
	experiments: parseAsStringLiteral(['required', 'not_required'] as const),
	resolution: parseAsStringLiteral(RESOURCE_PACK_RESOLUTIONS),
	content: parseAsStringLiteral(RESOURCE_PACK_CONTENT_TYPES),
}

const UPDATED_WITHIN_DAYS: Record<
	Exclude<ProjectUpdatedFilter, 'any'>,
	number
> = {
	week: 7,
	month: 30,
	quarter: 90,
	year: 365,
}

/** Start of a UTC day, so the value (and the cached query) holds all day. */
function updatedAfter(filter: ProjectUpdatedFilter) {
	if (filter === 'any') {
		return
	}
	const today = Math.floor(Date.now() / DAY_MS) * DAY_MS
	return today - UPDATED_WITHIN_DAYS[filter] * DAY_MS
}

function ProjectsDirectory() {
	const [url, setUrl] = useQueryStates(urlFilters, { history: 'replace' })
	// How many results the visitor has asked to see so far.
	const [wanted, setWanted] = useState(PAGE_SIZE)

	const filters: ProjectSearchFilters = useMemo(
		() => ({
			query: url.q,
			type: url.type ?? 'all',
			sort: url.sort,
			categoryIds: url.category as ProjectSearchFilters['categoryIds'],
			gameVersion: url.version,
			tags: url.tag,
			updated: url.updated,
			addonExperiments: url.experiments ?? 'all',
			resourcePackResolution: url.resolution ?? 'all',
			resourcePackContentType: url.content ?? 'all',
		}),
		[url],
	)

	const handleFiltersChange = useCallback(
		(next: ProjectSearchFilters) => {
			setWanted(PAGE_SIZE)
			setUrl({
				q: next.query,
				type: next.type === 'all' ? null : next.type,
				sort: next.sort,
				category: next.categoryIds,
				version: next.gameVersion,
				tag: next.tags,
				updated: next.updated,
				experiments:
					next.addonExperiments === 'all'
						? null
						: next.addonExperiments,
				resolution:
					next.resourcePackResolution === 'all'
						? null
						: next.resourcePackResolution,
				content:
					next.resourcePackContentType === 'all'
						? null
						: next.resourcePackContentType,
			})
		},
		[setUrl],
	)

	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.projects.listing.browse,
		{
			query: filters.query || undefined,
			sort: filters.sort,
			type: filters.type === 'all' ? undefined : filters.type,
			categoryIds:
				filters.categoryIds.length > 0
					? filters.categoryIds
					: undefined,
			gameVersion: filters.gameVersion || undefined,
			tags: filters.tags.length > 0 ? filters.tags : undefined,
			updatedAfter: updatedAfter(filters.updated),
			experimentalFeaturesRequired:
				filters.addonExperiments === 'all'
					? undefined
					: filters.addonExperiments === 'required',
			resourcePackResolution:
				filters.resourcePackResolution === 'all'
					? undefined
					: filters.resourcePackResolution,
			resourcePackContentType:
				filters.resourcePackContentType === 'all'
					? undefined
					: filters.resourcePackContentType,
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
				<div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
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
						<EmptyTitle>No projects found</EmptyTitle>
						<EmptyDescription>
							Try a broader search or remove one of your filters.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							onClick={() =>
								handleFiltersChange(EMPTY_PROJECT_FILTERS)
							}
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
				<div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
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
							{isSearching ? 'Loading...' : 'Load more projects'}
						</Button>
					</div>
				)}
			</>
		)
	}

	return (
		<PageShell
			actions={
				<Link
					className={buttonVariants({ variant: 'brand', size: 'xl' })}
					href="/dashboard/projects/add"
				>
					Publish a project
				</Link>
			}
			description="Community addons and resource packs. Every release is checked and reviewed before it goes live."
			title="Addons & resource packs"
		>
			<div className="mb-6">
				<AdvancedProjectSearch
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
								? `${results.length} project${results.length === 1 ? '' : 's'} found`
								: `Showing the first ${results.length} projects`}
						</p>
					)}
				</div>

				{renderResults()}
			</div>
		</PageShell>
	)
}

export default function ProjectsPage() {
	return (
		<Suspense>
			<ProjectsDirectory />
		</Suspense>
	)
}
