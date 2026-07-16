'use client'

import { useQuery } from 'convex/react'
import { AdminPageHeader } from '@/components/admin-dashboard/admin-page-header'
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'

export function AdminAnalytics() {
	const data = useQuery(api.functions.site.analytics.getAdminSummary, {
		days: 30,
	})
	if (data === undefined) {
		return <Skeleton className="h-96" />
	}
	const stats = [
		['Views', data.totals.views],
		['IP Copies', data.totals.ipCopies],
		['Downloads', data.totals.downloads],
		['Link Clicks', data.totals.outboundClicks],
		['Shares', data.totals.shares],
	] as const
	return (
		<div className="space-y-6">
			<AdminPageHeader
				description={`Platform engagement during the last ${data.periodDays} days.`}
				title="Analytics"
			/>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
				{stats.map(([label, value]) => (
					<Stat key={label}>
						<StatLabel>{label}</StatLabel>
						<StatValue>{value}</StatValue>
						<StatDescription>
							Recorded public actions
						</StatDescription>
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
					<CardTitle>Most Active Content</CardTitle>
				</CardHeader>
				<CardContent className="divide-y p-0">
					{data.topTargets.length === 0 ? (
						<p className="p-6 text-muted-foreground text-sm">
							No analytics events have been recorded yet.
						</p>
					) : (
						data.topTargets.map((target) => (
							<div
								className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] gap-4 px-6 py-4 text-sm"
								key={target.key}
							>
								<span className="truncate font-medium">
									{target.key}
								</span>
								<span>{target.views} views</span>
								<span>
									{target.downloads + target.ipCopies} actions
								</span>
								<span>{target.shares} shares</span>
							</div>
						))
					)}
				</CardContent>
			</Card>
		</div>
	)
}
