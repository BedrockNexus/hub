import {
	Add01Icon,
	CheckmarkCircle02Icon,
	Download01Icon,
	GithubIcon,
	Package01Icon,
	RepositoryIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { FunctionReturnType } from 'convex/server'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import {
	Stat,
	StatDescription,
	StatIndicator,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import {
	type PluginListRow,
	PluginListTable,
} from '@/components/plugins/plugin-list-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { fetchAuthQuery } from '@/lib/auth-server'
import { formatCompactNumber } from '@/lib/plugins/format-registry'
import { createPluginDashboardId } from '@/lib/plugins/plugin-dashboard-id'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
	title: 'Plugins',
	robots: { index: false, follow: false },
}

const statusMessages = {
	connected:
		'The GitHub App is connected and its public repositories are synchronized.',
	'configuration-error': 'The GitHub App credentials are not configured yet.',
	'invalid-callback': 'GitHub returned an incomplete installation callback.',
	'connection-failed':
		'The installation could not be verified. Start the GitHub flow again.',
} as const

type PluginTableStatus =
	| Doc<'plugins'>['status']
	| FunctionReturnType<
			typeof api.functions.plugins.publishing.model.listMine
	  >[number]['stage']

const pluginTableStatusLabels = {
	setup: 'Setting up',
	building: 'Ready for builds',
	preparing: 'Copying build',
	preparationFailed: 'Copy failed',
	inReview: 'In review',
	changesRequested: 'Changes requested',
	rejected: 'Rejected',
	publishing: 'Publishing',
	published: 'Published',
	draft: 'Draft',
	review: 'Review',
	archived: 'Archived',
} as const satisfies Record<PluginTableStatus, string>

export default async function PluginsDashboardPage({
	searchParams,
}: {
	searchParams: Promise<{ github?: string; account?: string }>
}) {
	const params = await searchParams
	const [projects, drafts, installations] = await Promise.all([
		fetchAuthQuery(api.functions.plugins.projects.listMine, {}),
		fetchAuthQuery(api.functions.plugins.publishing.model.listMine, {}),
		fetchAuthQuery(api.functions.plugins.github.installations.listMine, {}),
	])
	const draftByProjectId = new Map(
		drafts
			.filter(({ draft }) => draft.projectId)
			.map((entry) => [entry.draft.projectId as string, entry]),
	)
	const projectIds = new Set(
		projects.map((project) => project.projectId as string),
	)
	const rows = [
		...projects.map((project) => {
			const draftEntry = draftByProjectId.get(project.projectId as string)
			return {
				key: project.projectId as string,
				project,
				draft: draftEntry?.draft,
				stage: draftEntry?.stage,
				latestDraftVersion: draftEntry?.latestVersion,
				repository: draftEntry?.repository,
			}
		}),
		...drafts
			.filter(
				({ draft }) =>
					!(
						draft.projectId &&
						projectIds.has(draft.projectId as string)
					),
			)
			.map(({ draft, repository, stage, latestVersion }) => ({
				key: draft._id as string,
				project: null,
				draft,
				stage,
				latestDraftVersion: latestVersion,
				repository,
			})),
	].sort(
		(left, right) =>
			(right.project?.updatedAt ?? right.draft?.updatedAt ?? 0) -
			(left.project?.updatedAt ?? left.draft?.updatedAt ?? 0),
	)
	const tableRows: PluginListRow[] = rows.map((row) => {
		const status: PluginTableStatus =
			row.stage ?? row.project?.status ?? 'draft'
		const dashboardKey = row.repository
			? createPluginDashboardId(row.repository.githubRepositoryId)
			: null
		const published =
			row.project?.status === 'published' &&
			row.project.visibility === 'public'
		return {
			key: row.key,
			name: row.project?.name ?? row.draft?.name ?? 'Unnamed plugin',
			dashboardKey,
			repository: row.repository
				? {
						fullName: row.repository.fullName,
						htmlUrl: row.repository.htmlUrl,
					}
				: (row.project?.repository ?? null),
			version:
				row.project?.latestVersion?.version ??
				row.latestDraftVersion ??
				null,
			status,
			statusLabel: pluginTableStatusLabels[status],
			tone:
				status === 'published'
					? 'default'
					: status === 'rejected' || status === 'preparationFailed'
						? 'destructive'
						: 'outline',
			updatedAt: row.project?.updatedAt ?? row.draft?.updatedAt ?? 0,
			manageHref:
				row.draft && dashboardKey
					? `/dashboard/plugins/${dashboardKey}`
					: null,
			publicHref:
				published && row.project
					? `/plugins/${row.project.slug}`
					: null,
		}
	})
	const connectedRepositories = installations.reduce(
		(total, installation) => total + installation.repositories.length,
		0,
	)
	const publishedProjects = projects.filter(
		(project) => project.status === 'published',
	)
	const totalDownloads = projects.reduce(
		(total, project) => total + project.downloadCount,
		0,
	)
	const status =
		params.github && params.github in statusMessages
			? statusMessages[params.github as keyof typeof statusMessages]
			: null

	return (
		<DashboardPageShell
			actions={
				<Link
					className={buttonVariants()}
					href={'/dashboard/plugins/new' as Route}
				>
					<HugeiconsIcon className="size-4" icon={Add01Icon} />
					Add plugin
				</Link>
			}
			description="Connect repositories, build on every push, and send the builds you choose to moderator review."
			eyebrow="GitHub-native publishing"
			title="Plugins"
		>
			{status ? (
				<div className="flex items-start gap-3 rounded-md border bg-card p-4 text-sm">
					<HugeiconsIcon
						className="mt-0.5 size-5 shrink-0 text-primary"
						icon={CheckmarkCircle02Icon}
					/>
					<p>
						{status}
						{params.account
							? ` Connected account: ${params.account}.`
							: ''}
					</p>
				</div>
			) : null}

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{[
					{
						label: 'Plugins',
						value: rows.length.toString(),
						detail: 'Drafts and published plugins',
						icon: Package01Icon,
						color: 'default' as const,
					},
					{
						label: 'Connected repositories',
						value: connectedRepositories.toString(),
						detail: 'Public repositories available',
						icon: RepositoryIcon,
						color: 'info' as const,
					},
					{
						label: 'Published',
						value: publishedProjects.length.toString(),
						detail: 'Approved in the public catalog',
						icon: CheckmarkCircle02Icon,
						color: 'success' as const,
					},
					{
						label: 'Downloads',
						value: formatCompactNumber(totalDownloads),
						detail: 'Across published plugins',
						icon: Download01Icon,
						color: 'default' as const,
					},
				].map((metric) => (
					<Stat className="shadow-none" key={metric.label}>
						<StatLabel>{metric.label}</StatLabel>
						<StatIndicator color={metric.color} variant="icon">
							<HugeiconsIcon icon={metric.icon} />
						</StatIndicator>
						<StatValue>{metric.value}</StatValue>
						<StatDescription>{metric.detail}</StatDescription>
					</Stat>
				))}
			</div>

			{rows.length === 0 ? (
				<Card className="border-dashed shadow-none">
					<CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
						<span className="grid size-14 place-items-center rounded-md bg-primary text-primary-foreground">
							<HugeiconsIcon
								className="size-6"
								icon={Package01Icon}
							/>
						</span>
						<h2 className="mt-5 font-semibold text-lg">
							Add your first plugin
						</h2>
						<p className="mt-2 max-w-md text-muted-foreground text-sm leading-6">
							Choose a repository already granted to the GitHub
							App, or install the App during setup. Nothing
							becomes public until a moderator approves a version.
						</p>
						<Link
							className={cn(buttonVariants(), 'mt-5')}
							href={'/dashboard/plugins/new' as Route}
						>
							<HugeiconsIcon
								className="size-4"
								icon={Add01Icon}
							/>
							Add plugin
						</Link>
					</CardContent>
				</Card>
			) : (
				<div className="flex flex-col gap-3">
					<PluginListTable rows={tableRows} />
					<a
						className="inline-flex items-center gap-1.5 self-end text-muted-foreground text-xs hover:text-foreground"
						href="/api/github/install"
					>
						<HugeiconsIcon className="size-4" icon={GithubIcon} />
						Configure GitHub App
					</a>
				</div>
			)}
		</DashboardPageShell>
	)
}
