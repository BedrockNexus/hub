import {
	Add01Icon,
	CheckmarkCircle02Icon,
	Download01Icon,
	Edit02Icon,
	GithubIcon,
	Package01Icon,
	RepositoryIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
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
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { fetchAuthQuery } from '@/lib/auth-server'
import {
	formatCompactNumber,
	formatRegistryDate,
} from '@/lib/plugins/format-registry'
import { createProjectDashboardId } from '@/lib/plugins/project-dashboard-id'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
	title: 'Projects',
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

type ProjectTableStatus =
	| Doc<'plugins'>['status']
	| Doc<'pluginPublishingDrafts'>['status']

const projectTableStatusLabels = {
	detected: 'Detected',
	metadataReady: 'Metadata ready',
	workflowInstalled: 'Workflow installed',
	releaseDetected: 'Release detected',
	readyToPublish: 'Ready to publish',
	inReview: 'In review',
	changesRequested: 'Changes requested',
	rejected: 'Rejected',
	published: 'Published',
	draft: 'Draft',
	review: 'Review',
	archived: 'Archived',
} as const satisfies Record<ProjectTableStatus, string>

export default async function ProjectsPage({
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
			.map(({ draft, repository }) => ({
				key: draft._id as string,
				project: null,
				draft,
				repository,
			})),
	].sort(
		(left, right) =>
			(right.project?.updatedAt ?? right.draft?.updatedAt ?? 0) -
			(left.project?.updatedAt ?? left.draft?.updatedAt ?? 0),
	)
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
					Add project
				</Link>
			}
			description="Connect repositories, edit plugin metadata, verify GitHub releases, and submit them for moderator review from one workspace."
			eyebrow="GitHub-native publishing"
			title="Projects"
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
						label: 'Projects',
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
						detail: 'Across published projects',
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
							Add your first project
						</h2>
						<p className="mt-2 max-w-md text-muted-foreground text-sm leading-6">
							Choose a repository already granted to the GitHub
							App, or install the App during setup. Nothing
							becomes public until a moderator approves the
							verified release.
						</p>
						<Link
							className={cn(buttonVariants(), 'mt-5')}
							href={'/dashboard/plugins/new' as Route}
						>
							<HugeiconsIcon
								className="size-4"
								icon={Add01Icon}
							/>
							Add project
						</Link>
					</CardContent>
				</Card>
			) : (
				<Card className="overflow-hidden py-0 shadow-none">
					<Table className="min-w-[760px]">
						<TableHeader className="bg-muted/60">
							<TableRow className="hover:bg-transparent">
								<TableHead className="h-11 px-5">
									Project
								</TableHead>
								<TableHead>Release</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Updated</TableHead>
								<TableHead className="pr-5 text-right">
									Action
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => {
								const name =
									row.project?.name ??
									row.draft?.name ??
									'Detected project'
								const repository = row.repository
									? {
											fullName: row.repository.fullName,
											htmlUrl: row.repository.htmlUrl,
										}
									: (row.project?.repository ?? null)
								const statusValue =
									row.draft?.status ??
									row.project?.status ??
									'draft'
								const projectKey = row.repository
									? createProjectDashboardId(
											row.repository.githubRepositoryId,
										)
									: null
								const manageHref =
									row.draft && projectKey
										? (`/dashboard/plugins/${projectKey}` as Route)
										: null
								return (
									<TableRow key={row.key}>
										<TableCell className="px-5 py-3.5">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<p className="truncate font-semibold">
														{name}
													</p>
													{projectKey ? (
														<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
															{projectKey}
														</span>
													) : null}
												</div>
												{repository ? (
													<a
														className="mt-1 inline-flex max-w-72 items-center gap-1.5 truncate text-muted-foreground text-xs hover:text-foreground"
														href={
															repository.htmlUrl
														}
														rel="noreferrer"
														target="_blank"
													>
														<HugeiconsIcon
															className="size-3.5 shrink-0"
															icon={GithubIcon}
														/>
														<span className="truncate">
															{
																repository.fullName
															}
														</span>
													</a>
												) : (
													<span className="mt-1 block text-muted-foreground text-xs">
														Repository unavailable
													</span>
												)}
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{row.draft?.latestTag ??
												(row.project?.latestVersion
													? `v${row.project.latestVersion.version}`
													: 'No release')}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													statusValue === 'published'
														? 'default'
														: statusValue ===
																'rejected'
															? 'destructive'
															: 'outline'
												}
											>
												{
													projectTableStatusLabels[
														statusValue
													]
												}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{formatRegistryDate(
												row.project?.updatedAt ??
													row.draft?.updatedAt ??
													Date.now(),
											)}
										</TableCell>
										<TableCell className="pr-5">
											<div className="flex justify-end gap-1">
												{manageHref ? (
													<Link
														aria-label={`Edit ${name}`}
														className={buttonVariants(
															{
																variant:
																	'ghost',
																size: 'icon-sm',
															},
														)}
														href={manageHref}
														title={`Edit ${name}`}
													>
														<HugeiconsIcon
															icon={Edit02Icon}
														/>
													</Link>
												) : null}
												{row.project?.status ===
													'published' &&
												row.project.visibility ===
													'public' ? (
													<Link
														aria-label={`View ${row.project.name}`}
														className={buttonVariants(
															{
																variant:
																	'ghost',
																size: 'icon-sm',
															},
														)}
														href={
															`/plugins/${row.project.slug}` as Route
														}
													>
														<HugeiconsIcon
															icon={ViewIcon}
														/>
													</Link>
												) : null}
											</div>
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
					<div className="flex items-center justify-between border-t px-5 py-3 text-muted-foreground text-xs">
						<span>{rows.length} projects</span>
						<a
							className="inline-flex items-center gap-1.5 hover:text-foreground"
							href="/api/github/install"
						>
							<HugeiconsIcon
								className="size-4"
								icon={GithubIcon}
							/>
							Configure GitHub App
						</a>
					</div>
				</Card>
			)}
		</DashboardPageShell>
	)
}
