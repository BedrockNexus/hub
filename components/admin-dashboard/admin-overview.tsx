'use client'

import {
	ArrowRight01Icon,
	Flag01Icon,
	OfficeIcon,
	PuzzleIcon,
	ServerStack03Icon,
	Settings01Icon,
	UserBlock01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin-dashboard/admin-page-header'
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'

const QUICK_ACTIONS = [
	{
		description: 'Review project submissions awaiting a decision',
		href: '/admin/projects',
		icon: PuzzleIcon,
		label: 'Project moderation',
	},
	{
		description: 'Inspect published and flagged server listings',
		href: '/admin/servers',
		icon: ServerStack03Icon,
		label: 'Server moderation',
	},
	{
		description: 'Review bans, verification, and account roles',
		href: '/admin/users',
		icon: UserBlock01Icon,
		label: 'User access',
	},
	{
		description: 'Update SEO, branding, socials, and feature flags',
		href: '/admin/settings',
		icon: Settings01Icon,
		label: 'Site settings',
	},
]

function OverviewSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{['one', 'two', 'three', 'four'].map((key) => (
					<Skeleton className="h-28 rounded-lg" key={key} />
				))}
			</div>
			<Skeleton className="h-80 rounded-lg" />
		</div>
	)
}

export function AdminOverview() {
	const servers = useQuery(api.functions.servers.servers.listAdmin, {
		limit: 250,
	})
	const projects = useQuery(api.functions.projects.projects.listAdmin, {
		limit: 250,
	})
	const users = useQuery(api.functions.site.users.listAdmin, { limit: 250 })
	const organizations = useQuery(
		api.functions.site.organizations.listAdmin,
		{},
	)

	if (
		servers === undefined ||
		projects === undefined ||
		users === undefined ||
		organizations === undefined
	) {
		return <OverviewSkeleton />
	}

	const pendingProjects = projects.filter(
		(project) => project.status === 'under_review',
	)
	const serversNeedingReview = servers.filter(
		(server) =>
			server.status === 'under_review' ||
			(server.status === 'published' &&
				server.moderationStatus !== 'approved'),
	)
	const bannedUsers = users.filter((user) => user.banned)
	const riskyOrganizations = organizations.filter(
		(organization) => organization.riskStatus !== 'healthy',
	)

	const queues = [
		{
			count: pendingProjects.length,
			description: 'Projects awaiting approval or rejection',
			href: '/admin/projects',
			icon: PuzzleIcon,
			label: 'Pending projects',
		},
		{
			count: serversNeedingReview.length,
			description: 'Published unreviewed or hidden flagged servers',
			href: '/admin/servers',
			icon: Flag01Icon,
			label: 'Server reviews',
		},
		{
			count: bannedUsers.length,
			description: 'Accounts currently blocked from the platform',
			href: '/admin/users',
			icon: UserBlock01Icon,
			label: 'Banned users',
		},
		{
			count: riskyOrganizations.length,
			description: 'Missing owners or invitation issues',
			href: '/admin/organizations',
			icon: OfficeIcon,
			label: 'Organization risks',
		},
	]

	return (
		<div className="space-y-6">
			<AdminPageHeader
				actions={
					<Button
						nativeButton={false}
						render={<Link href="/admin/projects" />}
					>
						Review Projects
						<HugeiconsIcon
							className="size-4"
							icon={ArrowRight01Icon}
						/>
					</Button>
				}
				description="Monitor moderation queues, account access, organization health, and site operations."
				title="Admin Dashboard"
			/>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{queues.map((queue) => (
					<Stat key={queue.label}>
						<StatLabel>{queue.label}</StatLabel>
						<StatValue>{queue.count}</StatValue>
						<StatDescription>{queue.description}</StatDescription>
					</Stat>
				))}
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<Card>
					<CardHeader>
						<CardTitle>Needs Attention</CardTitle>
					</CardHeader>
					<CardContent className="divide-y p-0">
						{queues.map((queue) => (
							<Link
								className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50"
								href={queue.href}
								key={queue.label}
							>
								<div className="flex size-10 items-center justify-center rounded-md bg-muted">
									<HugeiconsIcon
										className="size-5"
										icon={queue.icon}
									/>
								</div>
								<div className="min-w-0 flex-1">
									<p className="font-medium text-sm">
										{queue.label}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{queue.description}
									</p>
								</div>
								<span className="font-semibold tabular-nums">
									{queue.count}
								</span>
							</Link>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-2">
						{QUICK_ACTIONS.map((action) => (
							<Link
								className="flex items-center gap-3 rounded-md p-3 hover:bg-muted/50"
								href={action.href}
								key={action.href}
							>
								<HugeiconsIcon
									className="size-5 text-muted-foreground"
									icon={action.icon}
								/>
								<div className="min-w-0">
									<p className="font-medium text-sm">
										{action.label}
									</p>
									<p className="line-clamp-2 text-muted-foreground text-xs">
										{action.description}
									</p>
								</div>
							</Link>
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
