'use client'

import {
	Calendar03Icon,
	PuzzleIcon,
	ServerStack03Icon,
	UserMultiple02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { useFullOrganization } from '@/hooks/use-organization'

function formatDate(date: Date) {
	return new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})
}

function getProjectStatusLabel(status?: string) {
	if (status === 'published') {
		return 'Published'
	}
	if (status === 'under_review') {
		return 'Under review'
	}
	return 'Draft'
}

interface OrgStatProps {
	label: string
	value: string | number
	hint?: string
	icon: typeof ServerStack03Icon
	tone: 'primary' | 'amber' | 'emerald'
}

const TONE_STYLES: Record<
	OrgStatProps['tone'],
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

function OrgStat({ label, value, hint, icon, tone }: OrgStatProps) {
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

export default function OrganizationOverviewPage() {
	const params = useParams()
	const slug = params.slug as string
	const { organization, loading, error, refetch } = useFullOrganization(slug)

	const orgServers = useQuery(
		api.functions.servers.servers.listByOrganization,
		organization?.id ? { organizationId: organization.id } : 'skip',
	)
	const orgProjects = useQuery(
		api.functions.projects.projects.listByOrganization,
		organization?.id ? { organizationId: organization.id } : 'skip',
	)

	if (loading) {
		return (
			<div className="flex flex-col gap-6">
				<Skeleton className="h-32 rounded-xl" />
				<div className="grid gap-4 sm:grid-cols-3">
					<Skeleton className="h-28 rounded-xl" />
					<Skeleton className="h-28 rounded-xl" />
					<Skeleton className="h-28 rounded-xl" />
				</div>
				<Skeleton className="h-64 rounded-xl" />
			</div>
		)
	}

	if (error || !organization) {
		return (
			<Card>
				<CardContent className="flex flex-col items-start gap-3 p-6">
					<h1 className="font-semibold text-lg">
						Organization unavailable
					</h1>
					<p className="text-muted-foreground text-sm">
						{error ??
							'You may not have permission to view this organization.'}
					</p>
					<Button
						onClick={() => refetch()}
						size="sm"
						variant="outline"
					>
						Try Again
					</Button>
				</CardContent>
			</Card>
		)
	}

	const logoUrl = (organization as { logo?: string }).logo
	const initials = organization.name.charAt(0).toUpperCase()

	return (
		<div className="flex flex-col gap-6">
			{/* Org header */}
			<Card className="overflow-hidden border-border/60">
				<CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
					<div className="pointer-events-none absolute inset-0 -z-10">
						<div className="absolute -top-20 -left-10 size-64 rounded-full bg-primary/10 blur-3xl" />
					</div>
					<div className="flex items-center gap-4">
						<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
							{logoUrl ? (
								<Image
									alt={organization.name}
									className="size-full object-cover"
									height={64}
									src={logoUrl}
									width={64}
								/>
							) : (
								<span className="font-bold text-2xl text-muted-foreground">
									{initials}
								</span>
							)}
						</div>
						<div className="flex flex-col gap-1">
							<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
								{organization.name}
							</h1>
							<p className="text-muted-foreground text-sm">
								/{organization.slug}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Stats */}
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<OrgStat
					hint="Active in this org"
					icon={UserMultiple02Icon}
					label="Members"
					tone="primary"
					value={organization.members.length}
				/>
				<OrgStat
					hint="Owned by this org"
					icon={ServerStack03Icon}
					label="Servers"
					tone="emerald"
					value={orgServers?.length ?? 0}
				/>
				<OrgStat
					hint="Owned by this org"
					icon={PuzzleIcon}
					label="Projects"
					tone="primary"
					value={orgProjects?.length ?? 0}
				/>
				<OrgStat
					icon={Calendar03Icon}
					label="Created"
					tone="amber"
					value={formatDate(organization.createdAt)}
				/>
			</div>

			{/* Org Servers */}
			<Card>
				<div className="flex items-center justify-between gap-3 border-b p-5">
					<div>
						<h2 className="font-semibold text-base">Servers</h2>
						<p className="text-muted-foreground text-sm">
							Servers owned by this organization
						</p>
					</div>
					<Link href={`/dashboard/organizations/${slug}/servers`}>
						<Button size="sm" variant="ghost">
							View all
						</Button>
					</Link>
				</div>
				{orgServers && orgServers.length > 0 ? (
					<div className="divide-y divide-border">
						{orgServers.map(
							(server: {
								_id: string
								name: string
								slug: string
								status?: string
							}) => (
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
												/{server.slug}
											</p>
										</div>
									</div>
									<Badge
										variant={
											server.status === 'published'
												? 'default'
												: 'secondary'
										}
									>
										{server.status === 'published'
											? 'Active'
											: 'Inactive'}
									</Badge>
								</Link>
							),
						)}
					</div>
				) : (
					<div className="p-6">
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<HugeiconsIcon icon={ServerStack03Icon} />
								</EmptyMedia>
								<EmptyTitle>No servers yet</EmptyTitle>
								<EmptyDescription>
									Add a server and select this organization as
									the owner to see it here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					</div>
				)}
			</Card>

			{/* Org Projects */}
			<Card>
				<div className="flex items-center justify-between gap-3 border-b p-5">
					<div>
						<h2 className="font-semibold text-base">Projects</h2>
						<p className="text-muted-foreground text-sm">
							Projects owned by this organization
						</p>
					</div>
					<Link href={`/dashboard/organizations/${slug}/projects`}>
						<Button size="sm" variant="ghost">
							View all
						</Button>
					</Link>
				</div>
				{orgProjects && orgProjects.length > 0 ? (
					<div className="divide-y divide-border">
						{orgProjects.map(
							(project: {
								_id: string
								name: string
								slug: string
								status?: string
							}) => (
								<Link
									className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40"
									href={`/dashboard/projects/${project.slug}/edit`}
									key={project._id}
								>
									<div className="flex min-w-0 flex-1 items-center gap-3">
										<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground text-sm uppercase">
											{project.name.charAt(0)}
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate font-medium text-sm">
												{project.name}
											</p>
											<p className="truncate text-muted-foreground text-xs">
												/{project.slug}
											</p>
										</div>
									</div>
									<Badge
										variant={
											project.status === 'published'
												? 'default'
												: 'secondary'
										}
									>
										{getProjectStatusLabel(project.status)}
									</Badge>
								</Link>
							),
						)}
					</div>
				) : (
					<div className="p-6">
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<HugeiconsIcon icon={PuzzleIcon} />
								</EmptyMedia>
								<EmptyTitle>No projects yet</EmptyTitle>
								<EmptyDescription>
									Create a project and select this
									organization as the owner to see it here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					</div>
				)}
			</Card>
		</div>
	)
}
