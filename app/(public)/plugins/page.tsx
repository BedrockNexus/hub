import { SearchMinusIcon } from '@hugeicons/core-free-icons'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ListingLayout } from '@/components/listings/listing-layout'
import { EmptyState } from '@/components/plugins/empty-state'
import { PluginGrid } from '@/components/plugins/plugin-card'
import { PluginSearchFilters } from '@/components/plugins/plugin-search-filters'
import { buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'

export const metadata: Metadata = {
	title: 'Minecraft Bedrock Server Plugins',
	description:
		'Find Minecraft Bedrock server plugins for every supported server software, built from public source and reviewed before release.',
	alternates: { canonical: '/plugins' },
}
type ExploreSearchParams = Promise<
	Record<string, string | string[] | undefined>
>
type RegistrySort = 'relevance' | 'latest' | 'rating'
function first(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value
}

export default async function ExplorePage({
	searchParams,
}: {
	searchParams: ExploreSearchParams
}) {
	const params = await searchParams
	const search = first(params.q)?.trim().slice(0, 100) || undefined
	const requestedSoftware = first(params.software)
	const requestedCategory = first(params.category)
	const requestedSort = first(params.sort)
	const cursor = first(params.cursor) || null
	const [allSoftware, categories] = await Promise.all([
		fetchQuery(api.functions.plugins.catalog.listSoftware, {}),
		fetchQuery(api.functions.plugins.categories.list, {}),
	])
	const software = allSoftware.filter((item) => item.supportsPlugins)
	const categorySlug = categories.some(
		(item) => item.slug === requestedCategory,
	)
		? requestedCategory
		: undefined
	const softwareSlug = software.some(
		(item) => item.slug === requestedSoftware,
	)
		? requestedSoftware
		: undefined
	const sort: RegistrySort = search
		? 'relevance'
		: requestedSort === 'rating'
			? 'rating'
			: 'latest'
	const queryArgs = {
		paginationOpts: { numItems: 20, cursor },
		search,
		softwareSlug,
		categorySlug,
		sort,
	}
	const result = await fetchQuery(
		api.functions.plugins.catalog.explore,
		queryArgs,
	).catch((error: unknown) => {
		if (!cursor) {
			throw error
		}
		return fetchQuery(api.functions.plugins.catalog.explore, {
			...queryArgs,
			paginationOpts: { ...queryArgs.paginationOpts, cursor: null },
		})
	})
	const filters = new URLSearchParams()
	if (search) {
		filters.set('q', search)
	}
	if (softwareSlug) {
		filters.set('software', softwareSlug)
	}
	if (categorySlug) {
		filters.set('category', categorySlug)
	}
	if (requestedSort === 'rating') {
		filters.set('sort', 'rating')
	}
	const firstHref = (
		filters.size ? `/plugins?${filters}` : '/plugins'
	) as Route
	if (!result.isDone) {
		filters.set('cursor', result.continueCursor)
	}
	const hasFilters = !!(search || softwareSlug || categorySlug)
	return (
		<ListingLayout
			action={
				<Link
					className={buttonVariants({ variant: 'outline' })}
					href="/dashboard/plugins/new"
				>
					Publish a plugin
				</Link>
			}
			title="Plugins"
		>
			<Suspense>
				<PluginSearchFilters
					categories={categories.map((item) => ({
						value: item.slug,
						label: item.name,
					}))}
					software={software.map((item) => ({
						value: item.slug,
						label: item.name,
					}))}
				/>
			</Suspense>
			<section aria-label="Results" className="min-w-0 space-y-4">
				<p aria-live="polite" className="text-muted-foreground text-sm">
					{!result.isDone || cursor ? 'Showing ' : ''}
					{result.page.length} plugin
					{result.page.length === 1 ? '' : 's'}
					{search ? ` matching “${search}”` : ''}
				</p>
				{result.page.length ? (
					<>
						<PluginGrid plugins={result.page} />
						{cursor || !result.isDone ? (
							<div className="flex justify-center gap-2 border-t pt-6">
								{cursor ? (
									<Link
										className={buttonVariants({
											variant: 'ghost',
										})}
										href={firstHref}
									>
										First page
									</Link>
								) : null}
								{result.isDone ? null : (
									<Link
										className={buttonVariants({
											variant: 'outline',
										})}
										href={`/plugins?${filters}` as Route}
									>
										Next page
									</Link>
								)}
							</div>
						) : null}
					</>
				) : (
					<EmptyState
						action={
							<Link
								className={buttonVariants({
									variant: 'outline',
								})}
								href={
									hasFilters
										? '/plugins'
										: '/dashboard/plugins/new'
								}
							>
								{hasFilters
									? 'Clear all filters'
									: 'Publish a plugin'}
							</Link>
						}
						description={
							hasFilters
								? 'Try a broader search or remove one of your filters.'
								: 'Reviewed releases appear here as soon as they are approved.'
						}
						icon={SearchMinusIcon}
						title={
							hasFilters
								? 'No plugins found'
								: 'No plugins published yet'
						}
					/>
				)}
			</section>
		</ListingLayout>
	)
}
