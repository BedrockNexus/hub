'use client'

import {
	ArrowUp01Icon,
	CheckmarkCircle02Icon,
	Settings02Icon,
	WifiDisconnected01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { formatDistanceToNowStrict } from 'date-fns'
import { useMemo, useState } from 'react'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { cn } from '@/lib/utils'

type Range = '24h' | '7d' | '30d'
type Overview = NonNullable<
	FunctionReturnType<typeof api.functions.servers.intelligence.getOverview>
>
type ServerEvent = FunctionReturnType<
	typeof api.functions.servers.intelligence.listEvents
>['page'][number]
type Point = FunctionReturnType<
	typeof api.functions.servers.intelligence.listHourly
>[number]

const RANGES: { value: Range; label: string }[] = [
	{ value: '24h', label: '24 hours' },
	{ value: '7d', label: '7 days' },
	{ value: '30d', label: '30 days' },
]

const PLAYERS = 'var(--chart-line-primary)'

function percent(value: number | null) {
	return value === null
		? '—'
		: `${(value * 100).toFixed(value === 1 ? 0 : 2)}%`
}

function formatDuration(ms: number) {
	const minutes = Math.max(1, Math.round(ms / 60_000))
	if (minutes < 60) {
		return `${minutes} min`
	}
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60
	return rest ? `${hours} h ${rest} min` : `${hours} h`
}

function pointLabel(at: number, range: Range) {
	const date = new Date(at)
	if (range === '24h') {
		return date.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
		})
	}
	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	})
}

function Tile({
	label,
	value,
	hint,
}: {
	label: string
	value: string
	hint?: string
}) {
	return (
		<div className="flex flex-col gap-0.5 rounded-md border bg-card px-4 py-3">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="font-mono font-semibold text-xl tabular-nums">
				{value}
			</dd>
			{hint ? (
				<dd className="text-muted-foreground text-xs">{hint}</dd>
			) : null}
		</div>
	)
}

function healthHint(overview: Overview) {
	if (overview.healthScore === null) {
		return 'Needs a few days of checks'
	}
	if (overview.incidents30d) {
		return `${overview.incidents30d} incidents in 30 days`
	}
	return 'No incidents in 30 days'
}

function uptimeColor(uptime: number) {
	if (uptime >= 0.999) {
		return 'bg-online'
	}
	return uptime >= 0.9 ? 'bg-online/50' : 'bg-offline'
}

function OverviewTiles({
	overview,
	range,
}: {
	overview: Overview
	range: Range
}) {
	const uptime = {
		'24h': overview.uptime24h,
		'7d': overview.uptime7d,
		'30d': overview.uptime30d,
	}[range]
	return (
		<dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<Tile label="Uptime" value={percent(uptime)} />
			<Tile
				hint={healthHint(overview)}
				label="Health score"
				value={
					overview.healthScore === null
						? '—'
						: `${overview.healthScore}/100`
				}
			/>
			<Tile
				hint="From BedrockNexus's checker"
				label="Latency, 24 h"
				value={
					overview.latency24h === null
						? '—'
						: `${overview.latency24h} ms`
				}
			/>
			<Tile
				label="Player record"
				value={(overview.peakPlayersEver ?? 0).toLocaleString()}
			/>
		</dl>
	)
}

/** Green to red blocks, one per point, like a status page. */
function UptimeStrip({ points }: { points: Point[] }) {
	if (points.length === 0) {
		return null
	}
	return (
		<div aria-hidden className="flex h-6 gap-px">
			{points.map((point) => (
				<span
					className={cn(
						'flex-1 rounded-[2px]',
						uptimeColor(point.uptime),
					)}
					key={point.at}
					title={`${percent(point.uptime)} online`}
				/>
			))}
		</div>
	)
}

function PlayersChart({ points, range }: { points: Point[]; range: Range }) {
	const data = useMemo(
		() =>
			points.map((point) => ({
				date: new Date(point.at),
				players: point.avgPlayers,
				peak: point.peakPlayers,
			})),
		[points],
	)
	if (points.length < 2) {
		return (
			<p className="rounded-md border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
				Not enough checks yet to draw a chart.
			</p>
		)
	}
	return (
		<AreaChart aspectRatio="3 / 1" data={data}>
			<Grid horizontal />
			<Area dataKey="players" fill={PLAYERS} fillOpacity={0.18} />
			<XAxis
				labels={points.map((point) => pointLabel(point.at, range))}
			/>
			<ChartTooltip
				rows={(point) => [
					{
						color: PLAYERS,
						label: 'Average players',
						value: Number(point.players ?? 0).toLocaleString(),
					},
					{
						color: PLAYERS,
						label: 'Peak',
						value: Number(point.peak ?? 0).toLocaleString(),
					},
				]}
			/>
		</AreaChart>
	)
}

function eventText(event: ServerEvent) {
	switch (event.kind) {
		case 'offline':
			return {
				icon: WifiDisconnected01Icon,
				tone: 'text-offline',
				text: 'Went offline',
			}
		case 'online':
			return {
				icon: CheckmarkCircle02Icon,
				tone: 'text-online',
				text: event.durationMs
					? `Back online after ${formatDuration(event.durationMs)}`
					: 'Back online',
			}
		case 'version_changed':
			return {
				icon: Settings02Icon,
				tone: 'text-muted-foreground',
				text: `Updated from ${event.fromVersion} to ${event.toVersion}`,
			}
		case 'player_record':
			return {
				icon: ArrowUp01Icon,
				tone: 'text-ember-text',
				text: `New player record: ${(event.players ?? 0).toLocaleString()}`,
			}
		default:
			return null
	}
}

function EventTimeline({ serverId }: { serverId: Id<'servers'> }) {
	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.servers.intelligence.listEvents,
		{ serverId },
		{ initialNumItems: 10 },
	)
	if (status === 'LoadingFirstPage') {
		return <Skeleton className="h-24" />
	}
	if (results.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No incidents, updates or records yet.
			</p>
		)
	}
	return (
		<div className="space-y-3">
			<ol className="space-y-2">
				{results.map((event) => {
					const text = eventText(event)
					if (!text) {
						return null
					}
					return (
						<li
							className="flex items-center gap-3 text-sm"
							key={event._id}
						>
							<HugeiconsIcon
								aria-hidden
								className={cn('size-4 shrink-0', text.tone)}
								icon={text.icon}
							/>
							<span className="min-w-0 flex-1">{text.text}</span>
							<time
								className="shrink-0 text-muted-foreground text-xs"
								dateTime={new Date(event.at).toISOString()}
								title={new Date(event.at).toLocaleString()}
							>
								{formatDistanceToNowStrict(event.at, {
									addSuffix: true,
								})}
							</time>
						</li>
					)
				})}
			</ol>
			{status === 'CanLoadMore' ? (
				<Button
					onClick={() => loadMore(20)}
					size="sm"
					type="button"
					variant="outline"
				>
					Older events
				</Button>
			) : null}
		</div>
	)
}

/** Uptime, players and incidents over time (roadmap Phase 5). */
export function ServerStatusHistory({ serverId }: { serverId: Id<'servers'> }) {
	const [range, setRange] = useState<Range>('24h')
	const overview = useQuery(api.functions.servers.intelligence.getOverview, {
		serverId,
	})
	const hourly = useQuery(
		api.functions.servers.intelligence.listHourly,
		range === '30d'
			? 'skip'
			: { serverId, hours: range === '24h' ? 24 : 168 },
	)
	const daily = useQuery(
		api.functions.servers.intelligence.listDaily,
		range === '30d' ? { serverId } : 'skip',
	)
	const points = range === '30d' ? daily : hourly

	if (overview === undefined) {
		return <Skeleton className="h-64" />
	}
	if (overview === null) {
		return null
	}
	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="font-bold text-2xl">Status history</h2>
					<p className="text-muted-foreground text-sm">
						Checked every 5 minutes by BedrockNexus.
					</p>
				</div>
				<Tabs
					onValueChange={(value) => setRange(value as Range)}
					value={range}
				>
					<TabsList aria-label="Time range">
						{RANGES.map((item) => (
							<TabsTrigger key={item.value} value={item.value}>
								{item.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>
			{overview.incidentOpenSince ? (
				<p className="rounded-md border border-offline/40 bg-offline/10 px-4 py-3 text-sm">
					Not answering status checks since{' '}
					{formatDistanceToNowStrict(overview.incidentOpenSince, {
						addSuffix: true,
					})}
					.
				</p>
			) : null}
			<OverviewTiles overview={overview} range={range} />
			{points === undefined ? (
				<Skeleton className="aspect-[3/1] w-full" />
			) : (
				<div className="space-y-2 rounded-md border bg-card p-4">
					<PlayersChart points={points} range={range} />
					<UptimeStrip points={points} />
				</div>
			)}
			<div className="space-y-2">
				<h3 className="font-semibold">Recent events</h3>
				<EventTimeline serverId={serverId} />
			</div>
		</section>
	)
}
