'use client'

import {
	ArrowDown01Icon,
	ArrowUp01Icon,
	LinkSquare01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import Link from 'next/link'
import { useMemo } from 'react'
import {
	AnalyticsNotice,
	AnalyticsPage,
	type AnalyticsRange,
	AnalyticsSkeleton,
	ChartCard,
	type ChartSeries,
	DIAMOND,
	formatCount,
	GOLD,
	SeriesLegend,
	TimeSeriesChart,
	useAnalyticsRange,
} from '@/components/user-dashboard/analytics/analytics-parts'
import { api } from '@/convex/_generated/api'
import { contentHref } from '@/lib/content-routes'
import { serverHref } from '@/lib/server-routes'
import { cn } from '@/lib/utils'

type Overview = FunctionReturnType<
	typeof api.functions.site.siteAnalytics.overview
>
type Totals = Overview['totals']
type TopItem = Overview['top'][number]

const GREEN = 'var(--chart-positive)'
const OPENPANEL_URL = 'https://analytics.amblydia.com'

const VIEWS: ChartSeries[] = [
	{ key: 'projectViews', label: 'Add-ons & packs', color: GOLD },
	{ key: 'serverViews', label: 'Servers', color: GREEN },
	{ key: 'pluginViews', label: 'Plugins', color: DIAMOND },
]
const DOWNLOADS: ChartSeries[] = [
	{ key: 'websiteDownloads', label: 'Website', color: GOLD },
	{ key: 'apiDownloads', label: 'Launcher & API', color: DIAMOND },
]
const PLAYERS: ChartSeries[] = [
	{ key: 'avgPlayers', label: 'Average players online', color: GREEN },
	{ key: 'addressCopies', label: 'Address copies', color: GOLD },
]
const GROWTH: ChartSeries[] = [
	{ key: 'signups', label: 'New accounts', color: GOLD },
	{ key: 'newListings', label: 'New listings', color: DIAMOND },
	{ key: 'reviews', label: 'Reviews', color: GREEN },
]

function views(totals: Totals) {
	return totals.projectViews + totals.pluginViews + totals.serverViews
}

function listings(totals: Totals) {
	return totals.newServers + totals.newProjects + totals.newPlugins
}

function Delta({ current, previous }: { current: number; previous: number }) {
	if (current === previous) {
		return <span className="text-muted-foreground text-xs">No change</span>
	}
	if (previous === 0) {
		return <span className="text-online text-xs">New this period</span>
	}
	const change = ((current - previous) / previous) * 100
	const up = change > 0
	return (
		<span
			className={cn(
				'inline-flex items-center gap-0.5 font-medium text-xs tabular-nums',
				up ? 'text-online' : 'text-destructive',
			)}
		>
			<HugeiconsIcon
				aria-hidden
				className="size-3.5"
				icon={up ? ArrowUp01Icon : ArrowDown01Icon}
			/>
			{Math.abs(change) >= 10
				? Math.round(Math.abs(change))
				: Math.abs(change).toFixed(1)}
			%<span className="sr-only">{up ? ' up' : ' down'}</span>
		</span>
	)
}

interface Kpi {
	label: string
	value: number
	previous: number
	hint?: string
	decimals?: boolean
}

function KpiGrid({ items, showDelta }: { items: Kpi[]; showDelta: boolean }) {
	return (
		<dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
			{items.map((item) => (
				<div
					className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3.5"
					key={item.label}
				>
					<dt className="text-muted-foreground text-sm">
						{item.label}
					</dt>
					<dd className="font-bold font-display text-2xl tabular-nums leading-tight">
						{item.decimals
							? item.value.toLocaleString('en', {
									maximumFractionDigits: 1,
								})
							: formatCount(item.value)}
					</dd>
					<dd className="flex min-h-4 flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
						{showDelta ? (
							<Delta
								current={item.value}
								previous={item.previous}
							/>
						) : null}
						{item.hint ? <span>{item.hint}</span> : null}
					</dd>
				</div>
			))}
		</dl>
	)
}

function LiveStrip({ live }: { live: NonNullable<Overview['live']> }) {
	const items = [
		{ label: 'Servers listed', value: live.servers },
		{ label: 'Players online', value: live.onlinePlayers, live: true },
		{ label: 'Add-ons & packs', value: live.projects },
		{ label: 'Plugins', value: live.plugins },
	]
	return (
		<section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border bg-surface-sunken/60 px-5 py-4">
			<p className="font-semibold text-sm">
				Right now
				<span className="block font-normal text-muted-foreground text-xs">
					Updated{' '}
					{new Date(live.updatedAt).toLocaleTimeString('en', {
						hour: 'numeric',
						minute: '2-digit',
					})}
				</span>
			</p>
			<dl className="flex flex-wrap gap-x-8 gap-y-3">
				{items.map((item) => (
					<div className="flex flex-col" key={item.label}>
						<dt className="order-2 text-muted-foreground text-xs">
							{item.label}
						</dt>
						<dd className="flex items-center gap-1.5 font-mono font-semibold text-xl tabular-nums">
							{item.live && item.value > 0 ? (
								<span
									aria-hidden
									className="size-2 rounded-full bg-online"
								/>
							) : null}
							{formatCount(item.value)}
						</dd>
					</div>
				))}
			</dl>
		</section>
	)
}

function itemHref(item: TopItem) {
	if (item.section === 'project') {
		return contentHref(
			item.project.type,
			item.project.slug,
			item.project.id,
			item.project.publicId,
		)
	}
	if (item.section === 'plugin') {
		return `/plugins/${encodeURIComponent(item.plugin.slug)}`
	}
	return serverHref(item.server)
}

function TopList({
	title,
	items,
	metrics,
}: {
	title: string
	items: TopItem[]
	metrics: { key: 'views' | 'downloads' | 'addressCopies'; label: string }[]
}) {
	return (
		<section className="flex flex-col rounded-lg border bg-card">
			<h3 className="border-b px-4 py-3 font-semibold">{title}</h3>
			{items.length > 0 ? (
				<table className="w-full table-fixed text-sm">
					<thead>
						<tr className="text-left text-muted-foreground text-xs">
							<th className="px-4 pt-2.5 pb-1 font-normal">
								Name
							</th>
							{metrics.map((metric) => (
								<th
									className="w-22 px-4 pt-2.5 pb-1 text-right font-normal"
									key={metric.key}
								>
									{metric.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{items.map((item, index) => (
							<tr
								className="border-t first:border-t-0"
								key={item.key}
							>
								<td className="px-4 py-2">
									<Link
										className="block truncate hover:text-primary"
										href={itemHref(item)}
										target="_blank"
									>
										<span className="mr-2 font-mono text-muted-foreground text-xs tabular-nums">
											{index + 1}
										</span>
										{item.name}
									</Link>
								</td>
								{metrics.map((metric) => (
									<td
										className="px-4 py-2 text-right font-mono tabular-nums"
										key={metric.key}
									>
										{formatCount(item[metric.key])}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			) : (
				<p className="px-4 py-8 text-center text-muted-foreground text-sm">
					No activity in this period.
				</p>
			)}
		</section>
	)
}

/** Site-wide traffic and growth, from functions/site/siteAnalytics. */
export function AdminAnalytics() {
	const { days, setDays, endDay } = useAnalyticsRange()
	const data = useQuery(api.functions.site.siteAnalytics.overview, {
		endDay,
		days,
	})
	return <AdminAnalyticsView data={data} days={days} onDaysChange={setDays} />
}

/** The page itself, given the overview (undefined while it loads). */
export function AdminAnalyticsView({
	data,
	days,
	onDaysChange,
}: {
	data: Overview | undefined
	days: AnalyticsRange
	onDaysChange: (days: AnalyticsRange) => void
}) {
	const rows = useMemo(
		() =>
			(data?.series ?? []).map((row) => ({
				...row,
				websiteDownloads: row.downloads - row.apiDownloads,
				newListings: row.newServers + row.newProjects + row.newPlugins,
			})),
		[data?.series],
	)

	return (
		<AnalyticsPage
			days={days}
			description="Traffic and growth across Bedrock Nexus, from the site's own counters. Each visitor counts once per item per day."
			onDaysChange={onDaysChange}
			title="Site analytics"
		>
			{data === undefined ? (
				<AnalyticsSkeleton />
			) : (
				<div className="flex flex-col gap-6">
					{data.live ? <LiveStrip live={data.live} /> : null}
					{data.rolledUpAt === null ? (
						<AnalyticsNotice>
							No daily totals yet. They are rolled up every hour;
							run functions/site/siteAnalytics:rollup with a
							number of days to fill in history.
						</AnalyticsNotice>
					) : null}

					<KpiGrid
						items={[
							{
								label: 'Page views',
								value: views(data.totals),
								previous: views(data.previousTotals),
							},
							{
								label: 'Downloads',
								value: data.totals.downloads,
								previous: data.previousTotals.downloads,
								hint: `${formatCount(data.totals.apiDownloads)} from the launcher`,
							},
							{
								label: 'Address copies',
								value: data.totals.addressCopies,
								previous: data.previousTotals.addressCopies,
							},
							{
								label: 'Avg players online',
								value: data.totals.avgPlayers,
								previous: data.previousTotals.avgPlayers,
								decimals: true,
							},
							{
								label: 'New accounts',
								value: data.totals.signups,
								previous: data.previousTotals.signups,
								hint:
									data.totals.newOrganizations > 0
										? `${formatCount(data.totals.newOrganizations)} new organizations`
										: undefined,
							},
							{
								label: 'New listings',
								value: listings(data.totals),
								previous: listings(data.previousTotals),
								hint: `${formatCount(data.totals.newServers)} servers · ${formatCount(data.totals.newProjects)} add-ons & packs · ${formatCount(data.totals.newPlugins)} plugins`,
							},
						]}
						showDelta={data.hasPreviousData}
					/>

					<div className="grid gap-6 xl:grid-cols-2">
						<ChartCard
							description="Detail page views per day, by section."
							title="Page views"
						>
							<TimeSeriesChart rows={rows} series={VIEWS} />
							<SeriesLegend series={VIEWS} />
						</ChartCard>
						<ChartCard
							description="Counted downloads of add-ons, packs and plugins."
							title="Downloads"
						>
							<TimeSeriesChart rows={rows} series={DOWNLOADS} />
							<SeriesLegend series={DOWNLOADS} />
						</ChartCard>
						<ChartCard
							description="Average players across every checked server, and how often visitors copied a server address."
							title="Servers"
						>
							<TimeSeriesChart rows={rows} series={PLAYERS} />
							<SeriesLegend series={PLAYERS} />
						</ChartCard>
						<ChartCard
							description={`New accounts, listings created and reviews written. ${formatCount(data.totals.follows)} follows this period.`}
							title="Growth"
						>
							<TimeSeriesChart rows={rows} series={GROWTH} />
							<SeriesLegend series={GROWTH} />
						</ChartCard>
					</div>

					<div className="flex flex-col gap-3">
						<h2 className="font-bold font-display text-xl">
							Busiest this period
						</h2>
						<div className="grid gap-4 lg:grid-cols-3">
							<TopList
								items={data.top.filter(
									(item) => item.section === 'project',
								)}
								metrics={[
									{ key: 'views', label: 'Views' },
									{ key: 'downloads', label: 'Downloads' },
								]}
								title="Add-ons & packs"
							/>
							<TopList
								items={data.top.filter(
									(item) => item.section === 'server',
								)}
								metrics={[
									{ key: 'views', label: 'Views' },
									{ key: 'addressCopies', label: 'Copies' },
								]}
								title="Servers"
							/>
							<TopList
								items={data.top.filter(
									(item) => item.section === 'plugin',
								)}
								metrics={[
									{ key: 'views', label: 'Views' },
									{ key: 'downloads', label: 'Downloads' },
								]}
								title="Plugins"
							/>
						</div>
					</div>

					<p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
						Where visitors come from, devices and countries are in
						OpenPanel.
						<a
							className="inline-flex items-center gap-1 text-foreground hover:text-primary"
							href={OPENPANEL_URL}
							rel="noreferrer"
							target="_blank"
						>
							Open OpenPanel
							<HugeiconsIcon
								aria-hidden
								className="size-3.5"
								icon={LinkSquare01Icon}
							/>
						</a>
					</p>
				</div>
			)}
		</AnalyticsPage>
	)
}
