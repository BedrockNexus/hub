import {
	CancelCircleIcon,
	CheckmarkCircle02Icon,
	Clock01Icon,
	WebhookIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'

export const metadata: Metadata = {
	title: 'Webhook deliveries',
	robots: { index: false, follow: false },
}

const statusIcons = {
	processing: Clock01Icon,
	processed: CheckmarkCircle02Icon,
	failed: CancelCircleIcon,
	ignored: WebhookIcon,
} as const

export default async function DeliveriesPage() {
	const deliveries = await fetchAuthQuery(
		api.functions.plugins.github.webhooks.listRecent,
		{},
	)

	return (
		<PageShell
			actions={<Badge variant="default">Live Convex records</Badge>}
			description="Inspect signature-verified GitHub deliveries, duplicate claims, retry attempts, and processing failures."
			title="Webhook deliveries"
		>
			{deliveries.length === 0 ? (
				<Card className="border-dashed shadow-none">
					<CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
						<span className="grid size-14 place-items-center rounded-md bg-primary text-primary-foreground">
							<HugeiconsIcon
								className="size-6"
								icon={WebhookIcon}
							/>
						</span>
						<h2 className="mt-5 font-semibold text-lg">
							No deliveries yet
						</h2>
						<p className="mt-2 max-w-lg text-muted-foreground text-sm leading-6">
							Signed deliveries will appear here after the GitHub
							App webhook URL is configured.
						</p>
					</CardContent>
				</Card>
			) : (
				<Card className="shadow-none">
					<CardContent className="divide-y">
						{deliveries.map((delivery) => (
							<div
								className="grid gap-4 py-5 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr_auto] sm:items-center"
								key={delivery._id}
							>
								<span className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
									<HugeiconsIcon
										className="size-5"
										icon={statusIcons[delivery.status]}
									/>
								</span>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-medium text-sm">
											{delivery.event}
											{delivery.action
												? `.${delivery.action}`
												: ''}
										</p>
										<Badge variant="outline">
											{delivery.status}
										</Badge>
									</div>
									<p className="mt-1 truncate text-muted-foreground text-xs">
										{delivery.deliveryId} ·{' '}
										{delivery.attemptCount}{' '}
										{delivery.attemptCount === 1
											? 'attempt'
											: 'attempts'}
									</p>
									{delivery.lastError ? (
										<p className="mt-2 text-destructive text-xs">
											{delivery.lastError}
										</p>
									) : null}
								</div>
								<div className="text-right text-muted-foreground text-xs">
									<p>
										{new Date(
											delivery.receivedAt,
										).toLocaleString()}
									</p>
									<p className="mt-1">
										{delivery.attempts
											.map(
												(attempt) =>
													`#${attempt.attemptNumber} ${attempt.status}`,
											)
											.join(' · ')}
									</p>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			)}
		</PageShell>
	)
}
