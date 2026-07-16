'use client'

import {
	Add01Icon,
	ArrowRight01Icon,
	PuzzleIcon,
	ServerStack03Icon,
	Settings01Icon,
	StarIcon,
	UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { authClient } from '@/lib/auth-client'

function getGreeting() {
	const hour = new Date().getHours()
	if (hour < 5) {
		return 'Still up'
	}
	if (hour < 12) {
		return 'Good morning'
	}
	if (hour < 18) {
		return 'Good afternoon'
	}
	return 'Good evening'
}

interface KpiCardProps {
	label: string
	value: string | number
	hint?: string
	icon: typeof ServerStack03Icon
	tone: 'primary' | 'amber' | 'emerald'
}

const TONE_STYLES: Record<
	KpiCardProps['tone'],
	{ bg: string; text: string; ring: string }
> = {
	primary: {
		bg: 'bg-primary/10',
		text: 'text-primary',
		ring: 'ring-primary/20',
	},
	amber: {
		bg: 'bg-amber-500/10',
		text: 'text-amber-500',
		ring: 'ring-amber-500/20',
	},
	emerald: {
		bg: 'bg-emerald-500/10',
		text: 'text-emerald-500',
		ring: 'ring-emerald-500/20',
	},
}

function KpiCard({ label, value, hint, icon, tone }: KpiCardProps) {
	const styles = TONE_STYLES[tone]
	return (
		<Card>
			<CardContent className="flex items-start justify-between gap-4 p-5">
				<div className="flex flex-col gap-1">
					<p className="text-muted-foreground text-sm">{label}</p>
					<p className="font-bold text-3xl tabular-nums tracking-tight">
						{value}
					</p>
					{hint ? (
						<p className="text-muted-foreground text-xs">{hint}</p>
					) : null}
				</div>
				<div
					className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${styles.bg} ${styles.text} ${styles.ring}`}
				>
					<HugeiconsIcon className="size-5" icon={icon} />
				</div>
			</CardContent>
		</Card>
	)
}

function KpiSkeleton() {
	return (
		<Card>
			<CardContent className="flex items-start justify-between gap-4 p-5">
				<div className="flex flex-1 flex-col gap-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-8 w-16" />
					<Skeleton className="h-3 w-20" />
				</div>
				<Skeleton className="size-10 rounded-lg" />
			</CardContent>
		</Card>
	)
}

const QUICK_ACTIONS = [
	{
		label: 'Add Server',
		description: 'List a new Bedrock server',
		href: '/dashboard/servers/add',
		icon: ServerStack03Icon,
	},
	{
		label: 'Create Project',
		description: 'Start an addon or world draft',
		href: '/dashboard/projects/add',
		icon: PuzzleIcon,
	},
	{
		label: 'New Organization',
		description: 'Collaborate with a team',
		href: '/dashboard/organizations',
		icon: UserGroupIcon,
	},
	{
		label: 'Settings',
		description: 'Manage your profile',
		href: '/dashboard/settings/profile',
		icon: Settings01Icon,
	},
]

export function DashboardOverview() {
	const { data: session } = authClient.useSession()

	const servers = useQuery(api.functions.servers.servers.listMyServers, {})

	const username = session?.user?.name || 'there'
	const isLoading = servers === undefined

	const serverCount = servers?.length ?? 0
	const totalReviews =
		servers?.reduce((sum, s) => sum + (s.reviewCount ?? 0), 0) ?? 0
	const avgRating = (() => {
		if (!servers || servers.length === 0) {
			return '0.0'
		}
		const rated = servers.filter((s) => (s.averageRating ?? 0) > 0)
		if (rated.length === 0) {
			return '0.0'
		}
		const sum = rated.reduce((acc, s) => acc + (s.averageRating ?? 0), 0)
		return (sum / rated.length).toFixed(1)
	})()

	let serversListContent: ReactNode
	if (isLoading) {
		serversListContent = (
			<div className="divide-y divide-border">
				{['s1', 's2', 's3'].map((key) => (
					<div
						className="flex items-center justify-between gap-3 p-4"
						key={key}
					>
						<div className="flex flex-1 items-center gap-3">
							<Skeleton className="size-10 rounded-lg" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-24" />
							</div>
						</div>
						<Skeleton className="h-6 w-12" />
					</div>
				))}
			</div>
		)
	} else if (serverCount === 0) {
		serversListContent = (
			<div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
				<div className="flex size-12 items-center justify-center rounded-full bg-muted">
					<HugeiconsIcon
						className="size-6 text-muted-foreground"
						icon={ServerStack03Icon}
					/>
				</div>
				<div className="space-y-1">
					<h3 className="font-semibold text-base">No servers yet</h3>
					<p className="text-muted-foreground text-sm">
						Get started by adding your first Bedrock server.
					</p>
				</div>
				<Link href="/dashboard/servers/add">
					<Button size="sm">
						<HugeiconsIcon
							className="mr-1.5 size-4"
							icon={Add01Icon}
						/>
						Add Your First Server
					</Button>
				</Link>
			</div>
		)
	} else {
		serversListContent = (
			<div className="divide-y divide-border">
				{servers?.slice(0, 5).map((server) => (
					<Link
						className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40"
						href={`/dashboard/servers/${server.slug}`}
						key={server._id}
					>
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground text-sm uppercase">
								{server.name.charAt(0)}
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">
									{server.name}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{server.reviewCount ?? 0} reviews
								</p>
							</div>
						</div>
						<Badge className="gap-1" variant="secondary">
							<HugeiconsIcon
								className="size-3 text-amber-500"
								icon={StarIcon}
							/>
							<span className="tabular-nums">
								{server.averageRating?.toFixed(1) ?? '0.0'}
							</span>
						</Badge>
					</Link>
				))}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Welcome banner */}
			<Card className="overflow-hidden border-border/60">
				<CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
					<div className="pointer-events-none absolute inset-0 -z-10">
						<div className="absolute -top-20 -left-10 size-64 rounded-full bg-primary/15 blur-3xl" />
						<div className="absolute -right-10 -bottom-20 size-64 rounded-full bg-amber-500/10 blur-3xl" />
					</div>
					<div className="flex flex-col gap-2">
						<p className="text-muted-foreground text-sm">
							{getGreeting()},
						</p>
						<h1 className="font-bold text-3xl tracking-tight">
							{username}
						</h1>
						<p className="max-w-md text-muted-foreground text-sm">
							Here&apos;s a quick look at how your servers are
							doing today.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Link href="/dashboard/servers/add">
							<Button>
								<HugeiconsIcon
									className="mr-1.5 size-4"
									icon={Add01Icon}
								/>
								Add Server
							</Button>
						</Link>
						<Link href="/dashboard/servers">
							<Button variant="outline">Manage Servers</Button>
						</Link>
					</div>
				</CardContent>
			</Card>

			{/* KPIs */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{isLoading ? (
					<>
						<KpiSkeleton />
						<KpiSkeleton />
						<KpiSkeleton />
					</>
				) : (
					<>
						<KpiCard
							hint="Active listings"
							icon={ServerStack03Icon}
							label="Total Servers"
							tone="primary"
							value={serverCount}
						/>
						<KpiCard
							hint="Across all servers"
							icon={StarIcon}
							label="Reviews"
							tone="amber"
							value={totalReviews}
						/>
						<KpiCard
							hint="Average score"
							icon={StarIcon}
							label="Avg Rating"
							tone="emerald"
							value={avgRating}
						/>
					</>
				)}
			</div>

			{/* Main grid */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Servers list */}
				<Card className="lg:col-span-2">
					<div className="flex items-center justify-between gap-3 border-b p-5">
						<div>
							<h2 className="font-semibold text-base">
								Your Servers
							</h2>
							<p className="text-muted-foreground text-sm">
								Quick overview of your latest listings
							</p>
						</div>
						<Link href="/dashboard/servers">
							<Button size="sm" variant="ghost">
								View all
								<HugeiconsIcon
									className="ml-1 size-4"
									icon={ArrowRight01Icon}
								/>
							</Button>
						</Link>
					</div>
					{serversListContent}
				</Card>

				{/* Quick actions */}
				<Card>
					<div className="border-b p-5">
						<h2 className="font-semibold text-base">
							Quick Actions
						</h2>
						<p className="text-muted-foreground text-sm">
							Common tasks at a glance
						</p>
					</div>
					<div className="grid gap-2 p-3">
						{QUICK_ACTIONS.map((action) => (
							<Link
								className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
								href={action.href}
								key={action.href}
							>
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
									<HugeiconsIcon
										className="size-4"
										icon={action.icon}
									/>
								</div>
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="font-medium text-sm">
										{action.label}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{action.description}
									</span>
								</div>
								<HugeiconsIcon
									className="size-4 text-muted-foreground"
									icon={ArrowRight01Icon}
								/>
							</Link>
						))}
					</div>
				</Card>
			</div>
		</div>
	)
}
