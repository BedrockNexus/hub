'use client'

import {
	CheckmarkCircle02Icon,
	GitBranchIcon,
	GithubIcon,
	Package01Icon,
	RefreshIcon,
	RepositoryIcon,
	WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/plugins/editors/markdown-editor'
import { PluginIconField } from '@/components/plugins/publishing/plugin-icon-field'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { formatBytes, formatRegistryDate } from '@/lib/plugins/format-registry'
import { createPluginDashboardId } from '@/lib/plugins/plugin-dashboard-id'
import {
	CHANGELOG_MAX_LENGTH,
	DESCRIPTION_MAX_LENGTH,
	type ProjectMetadataInput,
	projectMetadataSchema,
	releaseSubmissionSchema,
	releaseTagFor,
} from '@/lib/plugins/publishing/metadata'
import { cn } from '@/lib/utils'

type ReleaseStatus = Doc<'pluginReleases'>['status']

const releaseStatusLabels: Record<ReleaseStatus, string> = {
	preparing: 'Copying build',
	preparationFailed: 'Copy failed',
	inReview: 'In review',
	changesRequested: 'Changes requested',
	rejected: 'Rejected',
	publishing: 'Publishing',
	published: 'Published',
}

// A build whose version ended in one of these can be sent again.
const reusableStatuses = new Set<ReleaseStatus>([
	'preparationFailed',
	'changesRequested',
])

function errorMessage(error: unknown) {
	if (
		typeof error === 'object' &&
		error !== null &&
		'data' in error &&
		typeof error.data === 'object' &&
		error.data !== null &&
		'message' in error.data &&
		typeof error.data.message === 'string'
	) {
		return error.data.message
	}
	return error instanceof Error ? error.message : 'Something went wrong.'
}

function useBusy() {
	const [busy, setBusy] = useState<string | null>(null)
	async function run(name: string, operation: () => Promise<void>) {
		setBusy(name)
		try {
			await operation()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusy(null)
		}
	}
	return { busy, run }
}

/** The current time, refreshed every minute, for queries that compare dates. */
function useMinute() {
	const [now, setNow] = useState(
		() => Math.floor(Date.now() / 60_000) * 60_000,
	)
	useEffect(() => {
		const timer = setInterval(
			() => setNow(Math.floor(Date.now() / 60_000) * 60_000),
			60_000,
		)
		return () => clearInterval(timer)
	}, [])
	return now
}

function MetadataForm({
	draft,
	busy,
	published = false,
	submitLabel,
	onSave,
}: {
	draft: Doc<'pluginPublishingDrafts'>
	busy: boolean
	published?: boolean
	submitLabel: string
	onSave: (metadata: ProjectMetadataInput) => Promise<void>
}) {
	const [metadata, setMetadata] = useState<ProjectMetadataInput>({
		name: draft.name,
		slug: draft.slug,
		summary: draft.summary,
		description: draft.description,
	})
	const [validationError, setValidationError] = useState<string | null>(null)

	function update<Field extends keyof ProjectMetadataInput>(
		field: Field,
		value: ProjectMetadataInput[Field],
	) {
		setMetadata((current) => ({ ...current, [field]: value }))
	}

	return (
		<form
			className="grid gap-5 sm:grid-cols-2"
			onSubmit={async (event) => {
				event.preventDefault()
				const result = projectMetadataSchema.safeParse(metadata)
				if (!result.success) {
					setValidationError(
						result.error.issues[0]?.message ?? 'Check the details.',
					)
					return
				}
				setValidationError(null)
				await onSave(result.data)
			}}
		>
			<div className="flex flex-col gap-2 sm:col-span-2">
				<Label>Icon</Label>
				<PluginIconField
					disabled={busy}
					draftId={draft._id}
					iconUrl={draft.iconUrl}
					name={metadata.name || draft.name}
					published={published}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="plugin-name">Name</Label>
				<Input
					disabled={busy}
					id="plugin-name"
					onChange={(event) => update('name', event.target.value)}
					value={metadata.name}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="plugin-slug">Slug</Label>
				<Input
					disabled={busy}
					id="plugin-slug"
					onChange={(event) => update('slug', event.target.value)}
					value={metadata.slug}
				/>
			</div>
			<div className="space-y-2 sm:col-span-2">
				<Label htmlFor="plugin-summary">Summary</Label>
				<Input
					disabled={busy}
					id="plugin-summary"
					onChange={(event) => update('summary', event.target.value)}
					placeholder="One sentence about what the plugin does"
					value={metadata.summary}
				/>
			</div>
			<div className="space-y-2 sm:col-span-2">
				<Label id="plugin-description-label">Description</Label>
				<MarkdownEditor
					disabled={busy}
					labelledBy="plugin-description-label"
					maximumLength={DESCRIPTION_MAX_LENGTH}
					onChange={(value) =>
						update('description', value || undefined)
					}
					value={metadata.description ?? ''}
				/>
			</div>
			{validationError ? (
				<p className="text-destructive text-sm sm:col-span-2">
					{validationError}
				</p>
			) : null}
			<div className="flex justify-end sm:col-span-2">
				<Button disabled={busy} type="submit">
					{submitLabel}
				</Button>
			</div>
		</form>
	)
}

export function PluginManageNav({ draftId }: { draftId: string }) {
	const pathname = usePathname()
	const items = [
		{ href: `/dashboard/plugins/${draftId}`, label: 'Details' },
		{ href: `/dashboard/plugins/${draftId}/workflow`, label: 'Workflow' },
		{
			href: `/dashboard/plugins/${draftId}/releases`,
			label: 'Builds & versions',
		},
	] as const

	return (
		<div className="flex flex-wrap gap-2 border-b pb-4">
			{items.map((item) => {
				const active = pathname === item.href
				return (
					<Link
						className={cn(
							buttonVariants({
								variant: active ? 'default' : 'ghost',
								size: 'sm',
							}),
							'rounded-full',
						)}
						href={item.href as Route}
						key={item.href}
					>
						{item.label}
					</Link>
				)
			})}
		</div>
	)
}

/** Step 1 and 2: pick a repository, then confirm the prefilled details. */
export function AddPluginFlow() {
	const auth = useConvexAuth()
	const router = useRouter()
	const installations = useQuery(
		api.functions.plugins.github.installations.listMine,
		auth.isAuthenticated ? {} : 'skip',
	)
	const drafts = useQuery(
		api.functions.plugins.publishing.model.listMine,
		auth.isAuthenticated ? {} : 'skip',
	)
	const startFromRepository = useAction(
		api.functions.plugins.publishing.actions.startFromRepository,
	)
	const saveMetadata = useMutation(
		api.functions.plugins.publishing.model.saveMetadata,
	)
	const [repositoryId, setRepositoryId] =
		useState<Id<'githubRepositories'> | null>(null)
	const [draftId, setDraftId] = useState<Id<'pluginPublishingDrafts'> | null>(
		null,
	)
	const { busy, run } = useBusy()
	const repositories = (
		installations?.flatMap((installation) => installation.repositories) ??
		[]
	).filter(
		(repository) =>
			!repository.isPrivate && repository.accessStatus === 'granted',
	)
	const repository = repositories.find((item) => item._id === repositoryId)
	const draft = drafts?.find((entry) => entry.draft._id === draftId)?.draft

	return (
		<div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
			<Card className="h-fit shadow-none">
				<CardHeader>
					<span className="mb-3 grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
						<HugeiconsIcon
							className="size-5"
							icon={RepositoryIcon}
						/>
					</span>
					<CardTitle>Choose a repository</CardTitle>
					<CardDescription>
						Its name, description and README fill in the plugin
						details. Only public repositories can be published.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{auth.isLoading || installations === undefined ? (
						<p className="text-muted-foreground text-sm">
							Loading repositories…
						</p>
					) : repositories.length === 0 ? (
						<>
							<p className="text-muted-foreground text-sm">
								Install the GitHub App and give it access to the
								public repository you want to publish.
							</p>
							<a
								className={buttonVariants()}
								href="/api/github/install"
							>
								Install GitHub App
							</a>
						</>
					) : (
						<>
							<Select
								disabled={Boolean(draft)}
								onValueChange={(value) =>
									setRepositoryId(
										value as Id<'githubRepositories'> | null,
									)
								}
								value={repositoryId}
							>
								<SelectTrigger
									className="h-10 w-full"
									id="publishing-repository"
								>
									<SelectValue placeholder="Choose a public repository" />
								</SelectTrigger>
								<SelectContent>
									{repositories.map((item) => (
										<SelectItem
											key={item._id}
											value={item._id}
										>
											{item.fullName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								className="w-full"
								disabled={
									!repositoryId ||
									Boolean(draft) ||
									busy !== null
								}
								onClick={() =>
									run('start', async () => {
										if (!repositoryId) {
											return
										}
										setDraftId(
											await startFromRepository({
												repositoryId,
											}),
										)
									})
								}
							>
								{busy === 'start'
									? 'Reading repository…'
									: 'Use this repository'}
							</Button>
							<p className="text-muted-foreground text-xs">
								Missing a repository?{' '}
								<a
									className="text-primary hover:underline"
									href="/api/github/install"
								>
									Change the GitHub App’s access
								</a>
								.
							</p>
						</>
					)}
				</CardContent>
			</Card>

			{draft ? (
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Plugin details</CardTitle>
						<CardDescription>
							Filled in from{' '}
							{repository?.fullName ?? 'the repository'}. Edit
							anything; nothing is public until a moderator
							approves your first version.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<MetadataForm
							busy={busy !== null}
							draft={draft}
							key={draft._id}
							onSave={(metadata) =>
								run('metadata', async () => {
									await saveMetadata({
										draftId: draft._id,
										...metadata,
									})
									if (!repository) {
										throw new Error(
											'The selected repository is no longer available.',
										)
									}
									toast.success(
										'Details saved. Now pick a workflow.',
									)
									router.push(
										`/dashboard/plugins/${createPluginDashboardId(repository.githubRepositoryId)}/workflow` as Route,
									)
								})
							}
							submitLabel="Save and continue"
						/>
					</CardContent>
				</Card>
			) : (
				<Card className="border-dashed shadow-none">
					<CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
						<span className="grid size-14 place-items-center rounded-md border text-muted-foreground">
							<HugeiconsIcon
								className="size-6"
								icon={Package01Icon}
							/>
						</span>
						<h2 className="mt-5 font-semibold text-lg">
							Pick a repository to start
						</h2>
						<p className="mt-2 max-w-md text-muted-foreground text-sm">
							Then choose a build workflow. Every push builds your
							plugin, and you pick which build to publish.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

function StatusRow({
	label,
	children,
}: {
	label: string
	children: React.ReactNode
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-muted-foreground">{label}</span>
			<span className="truncate text-right">{children}</span>
		</div>
	)
}

export function PluginDetailsManager({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const auth = useConvexAuth()
	const project = useQuery(
		api.functions.plugins.publishing.model.getMine,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	const saveMetadata = useMutation(
		api.functions.plugins.publishing.model.saveMetadata,
	)
	const { busy, run } = useBusy()

	if (auth.isLoading || project === undefined) {
		return (
			<p className="text-muted-foreground text-sm">
				Loading plugin details…
			</p>
		)
	}

	const { draft, repository } = project
	const published = project.project?.status === 'published'
	return (
		<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Plugin details</CardTitle>
					<CardDescription>
						{published
							? 'Changes go live together with the next approved version, so moderators see them first.'
							: 'What people see on the plugin page.'}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<MetadataForm
						busy={busy !== null || project.locked}
						draft={draft}
						key={draft._id}
						onSave={(metadata) =>
							run('metadata', async () => {
								await saveMetadata({
									draftId: draft._id,
									...metadata,
								})
								toast.success('Details saved.')
							})
						}
						published={published}
						submitLabel="Save details"
					/>
				</CardContent>
			</Card>
			<div className="space-y-4">
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Plugin</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<StatusRow label="Status">
							<Badge variant="outline">
								{project.project?.status ?? 'setup'}
							</Badge>
						</StatusRow>
						<StatusRow label="Server software">
							{project.softwareName ?? 'Set by the workflow'}
						</StatusRow>
						<StatusRow label="License">
							{draft.license ?? 'None on GitHub'}
						</StatusRow>
						<StatusRow label="Repository">
							<a
								className="text-primary hover:underline"
								href={repository.htmlUrl}
								rel="noreferrer"
								target="_blank"
							>
								{repository.fullName}
							</a>
						</StatusRow>
					</CardContent>
				</Card>
				{project.locked ? (
					<Card className="border-primary shadow-none">
						<CardContent className="p-4 text-sm">
							Details are locked while a version is in review.
						</CardContent>
					</Card>
				) : null}
			</div>
		</div>
	)
}

export function PluginWorkflowManager({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const auth = useConvexAuth()
	const pathname = usePathname()
	const project = useQuery(
		api.functions.plugins.publishing.model.getMine,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	const workflows = useQuery(
		api.functions.plugins.publishing.model.listAvailableWorkflows,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	const selectWorkflow = useMutation(
		api.functions.plugins.publishing.model.selectWorkflow,
	)
	const installWorkflow = useAction(
		api.functions.plugins.publishing.actions.installWorkflow,
	)
	const { busy, run } = useBusy()

	if (auth.isLoading || project === undefined || workflows === undefined) {
		return (
			<p className="text-muted-foreground text-sm">Loading workflows…</p>
		)
	}
	const { draft, repository } = project
	const selectedWorkflow = workflows.find(
		(workflow) => workflow.key === draft.workflowTemplateKey,
	)
	const softwareNames = [
		...new Set(workflows.map((workflow) => workflow.softwareName)),
	]
	const releasesHref = pathname.replace(/\/workflow$/, '/releases') as Route

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<Card className="shadow-none">
				<CardHeader>
					<span className="mb-3 grid size-12 place-items-center rounded-md bg-primary text-primary-foreground">
						<HugeiconsIcon
							className="size-5"
							icon={WorkflowSquare01Icon}
						/>
					</span>
					<CardTitle>Build workflow</CardTitle>
					<CardDescription>
						Pick the workflow for your plugin’s server software.
						BedrockNexus commits it to{' '}
						<strong>{repository.defaultBranch}</strong>, and from
						then on every push builds your plugin on GitHub.
						Installing again updates it to the newest version.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					{workflows.length === 0 ? (
						<p className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
							No build workflow is available yet. BedrockNexus
							admins add them; check back soon.
						</p>
					) : null}
					{softwareNames.map((softwareName) => (
						<div className="space-y-3" key={softwareName}>
							<Label>{softwareName}</Label>
							<div className="grid gap-3 sm:grid-cols-2">
								{workflows
									.filter(
										(workflow) =>
											workflow.softwareName ===
											softwareName,
									)
									.map((workflow) => {
										const isSelected =
											workflow.key ===
											draft.workflowTemplateKey
										return (
											<button
												className={
													isSelected
														? 'rounded-md border border-primary bg-primary p-4 text-left text-primary-foreground'
														: 'rounded-md border p-4 text-left transition-colors hover:bg-muted'
												}
												disabled={
													project.locked ||
													busy !== null
												}
												key={workflow.key}
												onClick={() =>
													run('select', async () => {
														await selectWorkflow({
															draftId: draft._id,
															key: workflow.key,
														})
														toast.success(
															`${workflow.label} selected.`,
														)
													})
												}
												type="button"
											>
												<span className="block font-medium text-sm">
													{workflow.label}
												</span>
												<span
													className={
														isSelected
															? 'mt-1 block text-primary-foreground/80 text-xs'
															: 'mt-1 block text-muted-foreground text-xs'
													}
												>
													Builds a .
													{workflow.fileExtension} ·
													version {workflow.version}
												</span>
											</button>
										)
									})}
							</div>
						</div>
					))}
					<div className="rounded-md border bg-muted p-4 font-mono text-sm">
						.github/workflows/bedrocknexus-publish.yml
					</div>
					<div className="flex flex-wrap gap-3">
						<Button
							disabled={
								!(
									draft.projectId && draft.workflowTemplateKey
								) ||
								project.locked ||
								busy !== null
							}
							onClick={() =>
								run('install', async () => {
									const result = await installWorkflow({
										draftId: draft._id,
									})
									toast.success(
										result.updated
											? 'Workflow committed. Your next push builds the plugin.'
											: 'The repository already has this workflow.',
									)
								})
							}
						>
							<HugeiconsIcon
								className="size-4"
								icon={WorkflowSquare01Icon}
							/>
							{draft.workflowInstalled
								? 'Update workflow'
								: 'Install workflow'}
						</Button>
						{draft.workflowInstalled ? (
							<Link
								className={buttonVariants({
									variant: 'outline',
								})}
								href={releasesHref}
							>
								See builds
							</Link>
						) : null}
					</div>
				</CardContent>
			</Card>
			<Card className="h-fit shadow-none">
				<CardHeader>
					<CardTitle>Workflow status</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					<StatusRow label="Workflow file">
						<Badge
							variant={
								draft.workflowInstalled ? 'default' : 'outline'
							}
						>
							{draft.workflowInstalled
								? 'Installed'
								: 'Not installed'}
						</Badge>
					</StatusRow>
					<StatusRow label="Selected">
						{selectedWorkflow?.label ?? 'None'}
					</StatusRow>
					<StatusRow label="Version">
						{draft.workflowTemplateVersion ?? '—'}
					</StatusRow>
					{draft.workflowInstalled && draft.workflowCommitSha ? (
						<a
							className="block truncate text-primary hover:underline"
							href={`${repository.htmlUrl}/commit/${encodeURIComponent(draft.workflowCommitSha)}`}
							rel="noreferrer"
							target="_blank"
						>
							Commit {draft.workflowCommitSha.slice(0, 7)}
						</a>
					) : null}
					<p className="text-muted-foreground text-xs">
						Editing the workflow file in your repository makes new
						builds untraceable, and only traceable builds can be
						published.
					</p>
				</CardContent>
			</Card>
		</div>
	)
}

type Build = FunctionReturnType<
	typeof api.functions.plugins.publishing.model.listBuilds
>[number]

function SubmitBuildForm({
	build,
	busy,
	onCancel,
	onSubmit,
}: {
	build: Build
	busy: boolean
	onCancel: () => void
	onSubmit: (input: { version: string; changelog: string }) => Promise<void>
}) {
	const [version, setVersion] = useState('')
	const [changelog, setChangelog] = useState('')
	const [error, setError] = useState<string | null>(null)
	return (
		<form
			className="mt-4 space-y-4 rounded-md border bg-muted/40 p-4"
			onSubmit={async (event) => {
				event.preventDefault()
				const result = releaseSubmissionSchema.safeParse({
					version,
					changelog,
				})
				if (!result.success) {
					setError(
						result.error.issues[0]?.message ?? 'Check the version.',
					)
					return
				}
				setError(null)
				await onSubmit(result.data)
			}}
		>
			<p className="font-medium text-sm">
				Send build {build.commitSha.slice(0, 7)} to review
			</p>
			<div className="space-y-2">
				<Label htmlFor={`version-${build.buildId}`}>Version</Label>
				<Input
					disabled={busy}
					id={`version-${build.buildId}`}
					onChange={(event) => setVersion(event.target.value)}
					placeholder="1.0.0"
					value={version}
				/>
				<p className="text-muted-foreground text-xs">
					Shown on the plugin page and tagged on GitHub as{' '}
					<code>
						{releaseTagFor(
							version.trim().replace(/^v(?=\d)/i, '') || '1.0.0',
						)}
					</code>{' '}
					once approved. Published versions are never replaced.
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`changelog-${build.buildId}`}>Changelog</Label>
				<Textarea
					className="min-h-28"
					disabled={busy}
					id={`changelog-${build.buildId}`}
					maxLength={CHANGELOG_MAX_LENGTH}
					onChange={(event) => setChangelog(event.target.value)}
					placeholder="What changed in this version"
					value={changelog}
				/>
			</div>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
			<div className="flex justify-end gap-2">
				<Button
					disabled={busy}
					onClick={onCancel}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
				<Button disabled={busy} type="submit">
					Send to review
				</Button>
			</div>
		</form>
	)
}

export function PluginBuildsManager({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const auth = useConvexAuth()
	const now = useMinute()
	const project = useQuery(
		api.functions.plugins.publishing.model.getMine,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	const builds = useQuery(
		api.functions.plugins.publishing.model.listBuilds,
		auth.isAuthenticated ? { draftId, now } : 'skip',
	)
	const releases = useQuery(
		api.functions.plugins.publishing.model.listReleases,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	const syncBuilds = useAction(
		api.functions.plugins.publishing.actions.syncBuilds,
	)
	const submitRelease = useMutation(
		api.functions.plugins.publishing.model.submitRelease,
	)
	const retryGitHubRelease = useMutation(
		api.functions.plugins.publishing.model.retryGitHubRelease,
	)
	const [openBuildId, setOpenBuildId] = useState<Id<'pluginBuilds'> | null>(
		null,
	)
	const { busy, run } = useBusy()

	if (
		auth.isLoading ||
		project === undefined ||
		builds === undefined ||
		releases === undefined
	) {
		return <p className="text-muted-foreground text-sm">Loading builds…</p>
	}
	const { draft, repository } = project

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="space-y-6">
				<Card className="shadow-none">
					<CardHeader>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<CardTitle>Builds</CardTitle>
								<CardDescription>
									Every push to {repository.fullName} builds
									your plugin. Pick a successful build to
									publish it as a new version.
								</CardDescription>
							</div>
							<Button
								disabled={
									!draft.workflowInstalled || busy !== null
								}
								onClick={() =>
									run('sync', async () => {
										await syncBuilds({ draftId: draft._id })
										toast.success(
											'Builds refreshed from GitHub.',
										)
									})
								}
								variant="outline"
							>
								<HugeiconsIcon
									className="size-4"
									icon={RefreshIcon}
								/>
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-3">
						{draft.workflowInstalled ? (
							builds.length === 0 ? (
								<div className="rounded-md border border-dashed p-8 text-center">
									<HugeiconsIcon
										className="mx-auto size-7 text-muted-foreground"
										icon={Package01Icon}
									/>
									<p className="mt-3 font-medium">
										No builds yet
									</p>
									<p className="mt-1 text-muted-foreground text-sm">
										Push a commit to your repository. Builds
										appear here when GitHub starts them.
									</p>
								</div>
							) : (
								builds.map((build) => (
									<div
										className="rounded-md border p-4"
										key={build.buildId}
									>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-sm">
													{build.commitMessage ??
														'No commit message'}
												</p>
												<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
													<a
														className="font-mono hover:text-foreground"
														href={`${repository.htmlUrl}/commit/${build.commitSha}`}
														rel="noreferrer"
														target="_blank"
													>
														{build.commitSha.slice(
															0,
															7,
														)}
													</a>
													{build.branch ? (
														<span className="inline-flex items-center gap-1">
															<HugeiconsIcon
																className="size-3"
																icon={
																	GitBranchIcon
																}
															/>
															{build.branch}
														</span>
													) : null}
													<span>
														{formatRegistryDate(
															build.createdAt,
														)}
													</span>
													{build.artifactSize ? (
														<span>
															{formatBytes(
																build.artifactSize,
															)}
														</span>
													) : null}
													<a
														className="hover:text-foreground"
														href={build.logsUrl}
														rel="noreferrer"
														target="_blank"
													>
														Logs
													</a>
												</div>
											</div>
											<div className="flex shrink-0 flex-wrap items-center gap-2">
												{build.release ? (
													<Badge variant="secondary">
														{build.release.version}{' '}
														·{' '}
														{
															releaseStatusLabels[
																build.release
																	.status
															]
														}
													</Badge>
												) : null}
												{build.status ===
												'completed' ? (
													build.conclusion ===
													'success' ? (
														build.traceable ? (
															<Badge>
																Traceable
															</Badge>
														) : (
															<Badge variant="outline">
																Not traceable
															</Badge>
														)
													) : (
														<Badge variant="destructive">
															Failed
														</Badge>
													)
												) : (
													<Badge variant="outline">
														Building
													</Badge>
												)}
												<Button
													disabled={
														!build.publishable ||
														project.locked ||
														busy !== null ||
														(build.release !==
															null &&
															!reusableStatuses.has(
																build.release
																	.status,
															))
													}
													onClick={() =>
														setOpenBuildId(
															build.buildId,
														)
													}
													size="sm"
													title={
														build.unpublishableReason
													}
												>
													Publish
												</Button>
											</div>
										</div>
										{!build.publishable &&
										build.status === 'completed' &&
										build.unpublishableReason ? (
											<p className="mt-2 text-muted-foreground text-xs">
												{build.unpublishableReason}
											</p>
										) : null}
										{openBuildId === build.buildId ? (
											<SubmitBuildForm
												build={build}
												busy={busy !== null}
												onCancel={() =>
													setOpenBuildId(null)
												}
												onSubmit={(input) =>
													run('submit', async () => {
														await submitRelease({
															draftId: draft._id,
															buildId:
																build.buildId,
															...input,
														})
														setOpenBuildId(null)
														toast.success(
															`Version ${input.version} sent to review.`,
														)
													})
												}
											/>
										) : null}
									</div>
								))
							)
						) : (
							<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
								Install the build workflow first.
							</p>
						)}
					</CardContent>
				</Card>

				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Versions</CardTitle>
						<CardDescription>
							Builds you sent to review, newest first.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{releases.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No versions yet.
							</p>
						) : (
							releases.map((release) => (
								<div
									className="rounded-md border p-4 text-sm"
									key={release.releaseId}
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="font-semibold">
											{release.version}
										</p>
										<Badge
											variant={
												release.status === 'published'
													? 'default'
													: release.status ===
																'rejected' ||
															release.status ===
																'preparationFailed'
														? 'destructive'
														: 'outline'
											}
										>
											{
												releaseStatusLabels[
													release.status
												]
											}
										</Badge>
									</div>
									<p className="mt-1 text-muted-foreground text-xs">
										Build {release.commitSha.slice(0, 7)}
										{release.branch
											? ` on ${release.branch}`
											: ''}{' '}
										· sent{' '}
										{formatRegistryDate(
											release.submittedAt,
										)}
										{release.fileName && release.size
											? ` · ${release.fileName}, ${formatBytes(release.size)}`
											: ''}
									</p>
									{release.failureReason ? (
										<p className="mt-2 text-destructive text-xs">
											{release.failureReason}
										</p>
									) : null}
									{release.reviewNotes ? (
										<div className="mt-3 rounded-md border bg-muted p-3">
											<p className="font-medium text-xs">
												Moderator note
											</p>
											<p className="mt-1 text-muted-foreground">
												{release.reviewNotes}
											</p>
										</div>
									) : null}
									{release.status === 'published' ? (
										<div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
											<HugeiconsIcon
												className="size-3.5"
												icon={GithubIcon}
											/>
											{release.githubReleaseStatus ===
												'created' &&
											release.githubReleaseUrl ? (
												<a
													className="text-primary hover:underline"
													href={
														release.githubReleaseUrl
													}
													rel="noreferrer"
													target="_blank"
												>
													GitHub release{' '}
													{releaseTagFor(
														release.version,
													)}
												</a>
											) : release.githubReleaseStatus ===
												'failed' ? (
												<>
													<span className="text-destructive">
														{release.githubReleaseError ??
															'The GitHub release failed.'}
													</span>
													<Button
														disabled={busy !== null}
														onClick={() =>
															run(
																'github',
																async () => {
																	await retryGitHubRelease(
																		{
																			draftId:
																				draft._id,
																			releaseId:
																				release.releaseId,
																		},
																	)
																	toast.success(
																		'Trying again.',
																	)
																},
															)
														}
														size="sm"
														variant="outline"
													>
														Retry
													</Button>
												</>
											) : (
												<span className="text-muted-foreground">
													Creating the GitHub release…
												</span>
											)}
										</div>
									) : null}
									{release.sha256 ? (
										<p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
											SHA-256 {release.sha256}
										</p>
									) : null}
								</div>
							))
						)}
					</CardContent>
				</Card>
			</div>
			<Card className="h-fit shadow-none">
				<CardHeader>
					<CardTitle>How publishing works</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<p>
						1. Pick a build, give it a version number and write what
						changed.
					</p>
					<p>
						2. BedrockNexus copies the file from GitHub, so the file
						reviewed is the file published.
					</p>
					<p>3. A moderator approves it and the version goes live.</p>
					<p>
						4. BedrockNexus creates the GitHub release{' '}
						<code>v&#123;version&#125;</code> on that commit with
						the file attached.
					</p>
					<div className="flex items-start gap-2 border-t pt-3 text-muted-foreground text-xs">
						<HugeiconsIcon
							className="mt-0.5 size-4 shrink-0 text-primary"
							icon={CheckmarkCircle02Icon}
						/>
						Traceable means the build ran the unmodified
						BedrockNexus workflow on that commit. It is not a
						security review of the plugin’s code.
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
