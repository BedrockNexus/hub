'use client'

import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import {
	AnalyticsNotice,
	AnalyticsPage,
	AnalyticsSkeleton,
	ChartCard,
	type ChartSeries,
	DIAMOND,
	formatCount,
	GOLD,
	SeriesLegend,
	StatGrid,
	TimeSeriesChart,
	useAnalyticsRange,
} from '@/components/user-dashboard/analytics/analytics-parts'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

const COUNTING_NOTE =
	'Each person counts once a day, and visits by you and your team are not counted.'

const TRAFFIC: ChartSeries[] = [
	{ key: 'views', label: 'Page views', color: GOLD },
	{ key: 'downloads', label: 'Downloads', color: DIAMOND },
]

const MAX_VERSION_BARS = 10

function downloadHint(apiDownloads: number, downloads: number) {
	if (downloads === 0) {
		return undefined
	}
	return `${formatCount(downloads - apiDownloads)} website · ${formatCount(apiDownloads)} launcher`
}

/** Analytics for an addon or resource pack, on its dashboard. */
export function ProjectAnalytics({
	projectId,
	isPublic,
	label,
}: {
	projectId: Id<'projects'>
	isPublic: boolean
	label: string
}) {
	const { days, setDays, endDay } = useAnalyticsRange()
	const data = useQuery(api.functions.site.creatorAnalytics.forProject, {
		projectId,
		endDay,
		days,
	})
	const versionBars = useMemo(
		() =>
			(data?.versions ?? [])
				.slice(0, MAX_VERSION_BARS)
				.map((version) => ({
					name: version.version,
					downloads: version.downloads,
				})),
		[data?.versions],
	)

	return (
		<AnalyticsPage
			days={days}
			description={`How people find and download your ${label}. ${COUNTING_NOTE}`}
			onDaysChange={setDays}
			title="Analytics"
		>
			{isPublic ? null : (
				<AnalyticsNotice>
					Page views are counted once your {label} is published.
				</AnalyticsNotice>
			)}
			{data === undefined ? (
				<AnalyticsSkeleton />
			) : (
				<>
					<StatGrid
						items={[
							{ label: 'Page views', value: data.totals.views },
							{
								label: 'Downloads',
								value: data.totals.downloads,
								hint: downloadHint(
									data.totals.apiDownloads,
									data.totals.downloads,
								),
							},
							{ label: 'Net saves', value: data.totals.saves },
							{
								label: 'All-time downloads',
								value: data.totals.allTimeDownloads,
							},
						]}
					/>
					<ChartCard title={`Last ${days} days`}>
						<TimeSeriesChart rows={data.days} series={TRAFFIC} />
						<SeriesLegend series={TRAFFIC} />
					</ChartCard>
					<ChartCard
						description={
							data.versions.length > MAX_VERSION_BARS
								? `All-time downloads of your ${MAX_VERSION_BARS} most downloaded versions.`
								: 'All-time downloads of each version.'
						}
						title="Downloads by version"
					>
						{versionBars.length === 0 ? (
							<p className="py-6 text-center text-muted-foreground text-sm">
								No downloads yet.
							</p>
						) : (
							<BarChart aspectRatio="3 / 1" data={versionBars}>
								<Grid horizontal />
								<Bar dataKey="downloads" fill={DIAMOND} />
								<BarXAxis />
								<ChartTooltip
									rows={(point) => [
										{
											color: DIAMOND,
											label: 'Downloads',
											value: formatCount(
												Number(point.downloads ?? 0),
											),
										},
									]}
								/>
							</BarChart>
						)}
					</ChartCard>
				</>
			)}
		</AnalyticsPage>
	)
}

/** Analytics for a plugin, on its dashboard (keyed by its publishing draft). */
export function PluginAnalytics({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const { days, setDays, endDay } = useAnalyticsRange()
	const data = useQuery(api.functions.site.creatorAnalytics.forPlugin, {
		draftId,
		endDay,
		days,
	})

	return (
		<AnalyticsPage
			days={days}
			description={`How people find and download your plugin. ${COUNTING_NOTE}`}
			onDaysChange={setDays}
			title="Analytics"
		>
			{data === undefined ? <AnalyticsSkeleton /> : null}
			{data === null ? (
				<AnalyticsNotice>
					Analytics start once your plugin is published.
				</AnalyticsNotice>
			) : null}
			{data ? (
				<>
					<StatGrid
						items={[
							{ label: 'Page views', value: data.totals.views },
							{
								label: 'Downloads',
								value: data.totals.downloads,
								hint: downloadHint(
									data.totals.apiDownloads,
									data.totals.downloads,
								),
							},
							{
								label: 'Launcher downloads',
								value: data.totals.apiDownloads,
							},
						]}
					/>
					<ChartCard title={`Last ${days} days`}>
						<TimeSeriesChart rows={data.days} series={TRAFFIC} />
						<SeriesLegend series={TRAFFIC} />
					</ChartCard>
				</>
			) : null}
		</AnalyticsPage>
	)
}

const SERVER_TRAFFIC: ChartSeries[] = [
	{ key: 'views', label: 'Page views', color: GOLD },
	{ key: 'addressCopies', label: 'Address copies', color: DIAMOND },
]
const SERVER_PLAYERS: ChartSeries[] = [
	{ key: 'peakPlayers', label: 'Peak players', color: DIAMOND },
	{ key: 'averagePlayers', label: 'Average players', color: GOLD },
]

/** Analytics for a server, on its dashboard. */
export function ServerAnalytics({
	serverId,
	isPublic,
}: {
	serverId: Id<'servers'>
	isPublic: boolean
}) {
	const { days, setDays, endDay } = useAnalyticsRange()
	const data = useQuery(api.functions.site.creatorAnalytics.forServer, {
		serverId,
		endDay,
		days,
	})

	return (
		<AnalyticsPage
			days={days}
			description={`Who looks at your server and copies its address, and how busy it is. ${COUNTING_NOTE}`}
			onDaysChange={setDays}
			title="Analytics"
		>
			{isPublic ? null : (
				<AnalyticsNotice>
					Page views and address copies are counted once your server
					is published.
				</AnalyticsNotice>
			)}
			{data === undefined ? (
				<AnalyticsSkeleton />
			) : (
				<>
					<StatGrid
						items={[
							{ label: 'Page views', value: data.totals.views },
							{
								label: 'Address copies',
								value: data.totals.addressCopies,
							},
							{
								label: 'Peak players',
								value: data.totals.peakPlayers,
							},
						]}
					/>
					<ChartCard title={`Visits, last ${days} days`}>
						<TimeSeriesChart
							rows={data.days}
							series={SERVER_TRAFFIC}
						/>
						<SeriesLegend series={SERVER_TRAFFIC} />
					</ChartCard>
					<ChartCard
						description="From our status checks every few minutes. Days without a check show no data."
						title="Players"
					>
						<TimeSeriesChart
							rows={data.days}
							series={SERVER_PLAYERS}
						/>
						<SeriesLegend series={SERVER_PLAYERS} />
					</ChartCard>
				</>
			)}
		</AnalyticsPage>
	)
}
