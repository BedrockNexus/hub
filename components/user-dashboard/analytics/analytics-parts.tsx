'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * Building blocks for the creator analytics pages (projects, plugins,
 * servers). Charts are Bklit UI (components/charts); numbers come from the
 * first-party counters in convex/functions/site/creatorAnalytics.ts.
 */

export const ANALYTICS_RANGES = [7, 30, 90] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

const NUMBER = new Intl.NumberFormat('en')

export function formatCount(value: number) {
	return NUMBER.format(value)
}

/** The selected range and the last UTC day to show, fixed for the visit. */
export function useAnalyticsRange() {
	const [days, setDays] = useState<AnalyticsRange>(30)
	const endDay = useMemo(() => new Date().toISOString().slice(0, 10), [])
	return { days, setDays, endDay }
}

export function AnalyticsPage({
	title,
	description,
	days,
	onDaysChange,
	children,
}: {
	title: string
	description: string
	days: AnalyticsRange
	onDaysChange: (days: AnalyticsRange) => void
	children: ReactNode
}) {
	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="font-bold font-display text-2xl">{title}</h1>
					<p className="max-w-prose text-muted-foreground text-sm">
						{description}
					</p>
				</div>
				<Tabs
					onValueChange={(value) =>
						onDaysChange(Number(value) as AnalyticsRange)
					}
					value={String(days)}
				>
					<TabsList aria-label="Time range">
						{ANALYTICS_RANGES.map((range) => (
							<TabsTrigger key={range} value={String(range)}>
								{range} days
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>
			<Separator />
			{children}
		</div>
	)
}

export interface StatItem {
	label: string
	value: number
	hint?: string
}

export function StatGrid({ items }: { items: StatItem[] }) {
	return (
		<dl
			className={cn(
				'grid gap-3 sm:grid-cols-2',
				items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
			)}
		>
			{items.map((item) => (
				<div
					className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3.5"
					key={item.label}
				>
					<dt className="text-muted-foreground text-sm">
						{item.label}
					</dt>
					<dd className="font-bold font-display text-2xl tabular-nums leading-tight">
						{formatCount(item.value)}
					</dd>
					{item.hint ? (
						<dd className="text-muted-foreground text-xs">
							{item.hint}
						</dd>
					) : null}
				</div>
			))}
		</dl>
	)
}

export function ChartCard({
	title,
	description,
	children,
}: {
	title: string
	description?: string
	children: ReactNode
}) {
	return (
		<section className="rounded-lg border bg-card p-4 sm:p-5">
			<h3 className="font-semibold">{title}</h3>
			{description ? (
				<p className="text-muted-foreground text-sm">{description}</p>
			) : null}
			<div className="mt-3">{children}</div>
		</section>
	)
}

export interface ChartSeries {
	key: string
	label: string
	color: string
}

/**
 * One row per UTC day, as returned by the creator analytics queries. A value
 * of null means "no data that day" (e.g. a server that was not checked): it
 * draws as zero and reads as "No data" in the tooltip.
 */
export function TimeSeriesChart({
	rows,
	series,
}: {
	rows: ReadonlyArray<{ day: string } & Record<string, unknown>>
	series: ChartSeries[]
}) {
	const data = useMemo(
		() =>
			rows.map((row) => {
				const point: Record<string, unknown> = {
					date: new Date(`${row.day}T00:00:00Z`),
				}
				for (const item of series) {
					const value = row[item.key]
					point[item.key] = typeof value === 'number' ? value : 0
					point[`${item.key}Missing`] = value === null
				}
				return point
			}),
		[rows, series],
	)

	return (
		<AreaChart aspectRatio="3 / 1" data={data}>
			<Grid horizontal />
			{series.map((item) => (
				<Area
					dataKey={item.key}
					fill={item.color}
					fillOpacity={0.18}
					key={item.key}
				/>
			))}
			<XAxis />
			<ChartTooltip
				rows={(point) =>
					series.map((item) => ({
						color: item.color,
						label: item.label,
						value: point[`${item.key}Missing`]
							? 'No data'
							: formatCount(Number(point[item.key] ?? 0)),
					}))
				}
			/>
		</AreaChart>
	)
}

export function SeriesLegend({ series }: { series: ChartSeries[] }) {
	return (
		<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
			{series.map((item) => (
				<li className="flex items-center gap-2" key={item.key}>
					<span
						aria-hidden
						className="size-2.5 rounded-sm"
						style={{ background: item.color }}
					/>
					{item.label}
				</li>
			))}
		</ul>
	)
}

export function AnalyticsNotice({ children }: { children: ReactNode }) {
	return (
		<p className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm">
			{children}
		</p>
	)
}

export function AnalyticsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{['a', 'b', 'c', 'd'].map((key) => (
					<Skeleton className="h-24" key={key} />
				))}
			</div>
			<Skeleton className="aspect-[3/1] w-full" />
		</div>
	)
}

export const GOLD = 'var(--chart-line-primary)'
export const DIAMOND = 'var(--chart-line-secondary)'
