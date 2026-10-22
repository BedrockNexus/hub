import { Search01Icon, SearchMinusIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/plugins/empty-state'
import { PluginGrid } from '@/components/plugins/plugin-card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/convex/_generated/api'
import { formatCompactNumber } from '@/lib/plugins/format-registry'
import { cn } from '@/lib/utils'

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

const sortOptions: ReadonlyArray<{
	value: Exclude<RegistrySort, 'relevance'>
	label: string
}> = [
	{ value: 'latest', label: 'Recently updated' },
	{ value: 'rating', label: 'Top rated' },
]

function first(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value
}

function exploreHref(params: {
	q?: string
	software?: string
	category?: string
	sort?: RegistrySort
}) {
	const query = new URLSearchParams()
	if (params.q) {
		query.set('q', params.q)
	}
	if (params.software) {
		query.set('software', params.software)
	}
	if (params.category) {
		query.set('category', params.category)
	}
	if (
		params.sort &&
		params.sort !== 'latest' &&
		params.sort !== 'relevance'
	) {
		query.set('sort', params.sort)
	}
	const serialized = query.toString()
	return (serialized ? `/plugins?${serialized}` : '/plugins') as Route
}

function FilterGroup({
	title,
	children,
}: {
	title: string
	children: ReactNode
}) {
	return (
		<div>
			<h2 className="mb-2.5 px-2 font-bold font-display text-[13px] text-muted-foreground uppercase tracking-[0.1em]">
				{title}
			</h2>
			<ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
				{children}
			</ul>
		</div>
	)
}

function FilterLink({
	href,
	active,
	children,
	count,
}: {
	href: Route
	active: boolean
	children: ReactNode
	count?: number
}) {
	return (
		<li>
			<Link
				aria-current={active ? 'page' : undefined}
				className={cn(
					'flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted lg:border-transparent lg:px-2',
					active &&
						'border-primary bg-primary text-primary-foreground hover:bg-primary lg:border-primary',
				)}
				href={href}
			>
				<span className="truncate">{children}</span>
				{count === undefined ? null : (
					<span
						className={cn(
							'font-mono text-xs',
							active ? 'opacity-80' : 'text-muted-foreground',
						)}
					>
						{formatCompactNumber(count)}
					</span>
				)}
			</Link>
		</li>
	)
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
	// Only software that plugins can be published for is a useful filter.
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

	const nextParams = new URLSearchParams()
	if (search) {
		nextParams.set('q', search)
	}
	if (softwareSlug) {
		nextParams.set('software', softwareSlug)
	}
	if (categorySlug) {
		nextParams.set('category', categorySlug)
	}
	if (sort === 'rating') {
		nextParams.set('sort', sort)
	}
	if (!result.isDone) {
		nextParams.set('cursor', result.continueCursor)
	}

	const totalCount = software.reduce(
		(total, item) => total + item.projectCount,
		0,
	)
	const activeSoftware = software.find((item) => item.slug === softwareSlug)

	return (
		<main className="flex w-full flex-1 flex-col">
			<header className="border-b bg-surface-sunken">
				<div className="container mx-auto flex flex-col gap-4.5 px-4 pt-10 pb-8 md:px-6">
					<h1 className="font-bold text-[clamp(2rem,4vw,3rem)] leading-none">
						{activeSoftware
							? `${activeSoftware.name} plugins`
							: 'Plugins'}
					</h1>
					<search className="block max-w-3xl">
						<form className="flex flex-wrap gap-2.5">
							{softwareSlug ? (
								<input
									name="software"
									type="hidden"
									value={softwareSlug}
								/>
							) : null}
							{categorySlug ? (
								<input
									name="category"
									type="hidden"
									value={categorySlug}
								/>
							) : null}
							<label
								className="relative min-w-0 flex-1"
								htmlFor="registry-search"
							>
								<HugeiconsIcon
									aria-hidden="true"
									className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
									icon={Search01Icon}
								/>
								<span className="sr-only">Search plugins</span>
								<Input
									className="h-12 bg-card pl-9 text-base"
									defaultValue={search}
									id="registry-search"
									name="q"
									placeholder={
										activeSoftware
											? `Search ${activeSoftware.name} plugins`
											: 'Search plugins'
									}
									type="search"
								/>
							</label>
							<Button size="xl" type="submit" variant="brand">
								Search
							</Button>
						</form>
					</search>
				</div>
			</header>
			<div className="container mx-auto grid w-full gap-6 px-4 pt-7 pb-16 md:px-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
				<aside
					aria-label="Filters"
					className="flex flex-col gap-5 self-start rounded-md border bg-card p-5 lg:sticky lg:top-24"
				>
					<FilterGroup title="Software">
						<FilterLink
							active={!softwareSlug}
							count={totalCount}
							href={exploreHref({
								q: search,
								category: categorySlug,
								sort,
							})}
						>
							All software
						</FilterLink>
						{software.map((item) => (
							<FilterLink
								active={item.slug === softwareSlug}
								count={item.projectCount}
								href={exploreHref({
									q: search,
									software: item.slug,
									category: categorySlug,
									sort,
								})}
								key={item.slug}
							>
								{item.name}
							</FilterLink>
						))}
					</FilterGroup>

					{categories.length > 0 ? (
						<FilterGroup title="Categories">
							<FilterLink
								active={!categorySlug}
								href={exploreHref({
									q: search,
									software: softwareSlug,
									sort,
								})}
							>
								All categories
							</FilterLink>
							{categories.map((item) => (
								<FilterLink
									active={item.slug === categorySlug}
									href={exploreHref({
										q: search,
										software: softwareSlug,
										category: item.slug,
										sort,
									})}
									key={item.slug}
								>
									{item.name}
								</FilterLink>
							))}
						</FilterGroup>
					) : null}

					{search ? null : (
						<FilterGroup title="Sort">
							{sortOptions.map((option) => (
								<FilterLink
									active={sort === option.value}
									href={exploreHref({
										software: softwareSlug,
										category: categorySlug,
										sort: option.value,
									})}
									key={option.value}
								>
									{option.label}
								</FilterLink>
							))}
						</FilterGroup>
					)}
				</aside>
				<div className="flex min-w-0 flex-col gap-3.5">
					<p className="text-muted-foreground">
						{search ? (
							<>
								Results for{' '}
								<span className="font-medium text-foreground">
									"{search}"
								</span>
								,{' '}
								<Link
									className="underline-offset-4 hover:underline"
									href={exploreHref({
										software: softwareSlug,
										category: categorySlug,
									})}
								>
									Clear search
								</Link>
							</>
						) : sort === 'rating' ? (
							'Sorted by rating'
						) : (
							'Sorted by most recently updated'
						)}
					</p>

					{result.page.length > 0 ? (
						<>
							<PluginGrid plugins={result.page} />
							{cursor || !result.isDone ? (
								<div className="mt-6 flex justify-center gap-2">
									{cursor ? (
										<Link
											className={buttonVariants({
												variant: 'ghost',
											})}
											href={exploreHref({
												q: search,
												software: softwareSlug,
												category: categorySlug,
												sort,
											})}
										>
											First page
										</Link>
									) : null}
									{result.isDone ? null : (
										<Link
											className={buttonVariants({
												variant: 'outline',
											})}
											href={
												`/plugins?${nextParams.toString()}` as Route
											}
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
								search || softwareSlug ? (
									<Link
										className={buttonVariants({
											variant: 'outline',
										})}
										href="/plugins"
									>
										Clear filters
									</Link>
								) : (
									<Link
										className={buttonVariants()}
										href="/dashboard/plugins/new"
									>
										Publish a plugin
									</Link>
								)
							}
							description={
								search || softwareSlug
									? 'Try a broader search or a different server software. Newly published plugins appear here automatically.'
									: 'Reviewed releases appear here as soon as they are approved.'
							}
							icon={SearchMinusIcon}
							title={
								search || softwareSlug
									? 'No plugins matched'
									: 'No plugins published yet'
							}
						/>
					)}
				</div>
			</div>
		</main>
	)
}
