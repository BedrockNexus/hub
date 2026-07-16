'use client'

import { useQuery } from 'convex/react'
import Link from 'next/link'
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { api } from '@/convex/_generated/api'

export function AnalyticsDashboard() {
	const data = useQuery(api.functions.site.analytics.getMine, { days: 30 })
	if (data === undefined) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-20" />
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
					{['1', '2', '3', '4', '5'].map((key) => (
						<Skeleton className="h-28" key={key} />
					))}
				</div>
			</div>
		)
	}

	const stats = [
		['Views', data.aggregate.views, 'Public detail page views'],
		['IP Copies', data.aggregate.ipCopies, 'Server connection intent'],
		['Downloads', data.aggregate.downloads, 'Project file downloads'],
		['Link Clicks', data.aggregate.outboundClicks, 'External link visits'],
		['Shares', data.aggregate.shares, 'Share actions'],
	] as const

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				description={`Performance across your content over the last ${data.periodDays} days.`}
				title="Analytics"
			/>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
				{stats.map(([label, value, description]) => (
					<Stat key={label}>
						<StatLabel>{label}</StatLabel>
						<StatValue>{value}</StatValue>
						<StatDescription>{description}</StatDescription>
					</Stat>
				))}
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Publish Funnel</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-3">
					{[
						['Drafts', data.funnel.draft],
						['Under Review', data.funnel.under_review],
						['Published', data.funnel.published],
					].map(([label, value]) => (
						<div className="rounded-md border p-4" key={label}>
							<p className="text-muted-foreground text-sm">
								{label}
							</p>
							<p className="font-semibold text-2xl tabular-nums">
								{value}
							</p>
						</div>
					))}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Content Performance</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{data.items.length === 0 ? (
						<p className="p-6 text-muted-foreground text-sm">
							Publish a server or project to begin collecting
							analytics.
						</p>
					) : (
						<div className="divide-y">
							{data.items.map((item) => (
								<Link
									className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-4 px-6 py-4 hover:bg-muted/40"
									href={`/${item.targetType === 'server' ? 'servers' : 'projects'}/${item.slug}`}
									key={`${item.targetType}:${item.targetId}`}
								>
									<div className="min-w-0">
										<p className="truncate font-medium text-sm">
											{item.name}
										</p>
										<p className="text-muted-foreground text-xs capitalize">
											{item.targetType}
										</p>
									</div>
									<span className="text-right text-sm tabular-nums">
										<strong>{item.views}</strong>
										<span className="ml-1 hidden text-muted-foreground sm:inline">
											views
										</span>
									</span>
									<span className="text-right text-sm tabular-nums">
										<strong>
											{item.targetType === 'server'
												? item.ipCopies
												: item.downloads}
										</strong>
										<span className="ml-1 hidden text-muted-foreground sm:inline">
											actions
										</span>
									</span>
									<span className="text-right text-sm tabular-nums">
										<strong>{item.shares}</strong>
										<span className="ml-1 hidden text-muted-foreground sm:inline">
											shares
										</span>
									</span>
								</Link>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
