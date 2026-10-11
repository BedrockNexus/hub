'use client'

import {
	CheckmarkCircle02Icon,
	Package01Icon,
	RefreshIcon,
	RepositoryIcon,
	Search01Icon,
	WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/plugins/editors/markdown-editor'
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
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { createProjectDashboardId } from '@/lib/plugins/project-dashboard-id'
import {
	type ProjectMetadataInput,
	projectMetadataSchema,
} from '@/lib/plugins/publishing/metadata'
import { cn } from '@/lib/utils'

type BusyAction =
	| 'analyze'
	| 'metadata'
	| 'workflow'
	| 'refresh'
	| 'release'
	| 'submit'
	| null

function errorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: 'The publishing action failed.'
}

function statusLabel(status: Doc<'pluginPublishingDrafts'>['status']) {
	return status.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function adapterLabel(adapterId: Doc<'pluginPublishingDrafts'>['adapterId']) {
	return adapterId === 'pocketmine-mp' ? 'PocketMine-MP' : 'PowerNukkitX'
}

function MetadataForm({
	draft,
	busy,
	submitLabel,
	onSave,
}: {
	draft: Doc<'pluginPublishingDrafts'>
	busy: boolean
	submitLabel: string
	onSave: (metadata: ProjectMetadataInput) => Promise<void>
}) {
	const [metadata, setMetadata] = useState<ProjectMetadataInput>({
		name: draft.name,
		slug: draft.slug,
		summary: draft.summary,
		description: draft.description,
		adapterId: draft.adapterId,
		projectType: 'plugin',
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
						result.error.issues[0]?.message ??
							'Review the metadata.',
					)
					return
				}
				setValidationError(null)
				await onSave(result.data)
			}}
		>
			<div className="space-y-2">
				<Label htmlFor="project-name">Project name</Label>
				<Input
					id="project-name"
					onChange={(event) => update('name', event.target.value)}
					value={metadata.name}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="project-slug">Project slug</Label>
				<Input
					id="project-slug"
					onChange={(event) => update('slug', event.target.value)}
					value={metadata.slug}
				/>
			</div>
			<div className="space-y-2 sm:col-span-2">
				<Label htmlFor="project-summary">Summary</Label>
				<Input
					id="project-summary"
					onChange={(event) => update('summary', event.target.value)}
					value={metadata.summary}
				/>
			</div>
			<div className="space-y-2 sm:col-span-2">
				<Label id="project-description-label">Description</Label>
				<MarkdownEditor
					disabled={busy}
					labelledBy="project-description-label"
					maximumLength={8000}
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

export function ProjectManageNav({ draftId }: { draftId: string }) {
	const pathname = usePathname()
	const items = [
		{ href: `/dashboard/plugins/${draftId}`, label: 'Metadata' },
		{ href: `/dashboard/plugins/${draftId}/workflow`, label: 'Workflow' },
		{
			href: `/dashboard/plugins/${draftId}/releases`,
			label: 'Releases & review',
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

export function AddProjectFlow() {
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
	const analyzeRepository = useAction(
		api.functions.plugins.publishing.actions.analyzeRepository,
	)
	const saveMetadata = useMutation(
		api.functions.plugins.publishing.model.saveMetadata,
	)
	const [selectedRepositoryId, setSelectedRepositoryId] =
		useState<Id<'githubRepositories'> | null>(null)
	const [selectedDraftId, setSelectedDraftId] =
		useState<Id<'pluginPublishingDrafts'> | null>(null)
	const [busyAction, setBusyAction] = useState<BusyAction>(null)
	const repositories =
		installations?.flatMap((installation) => installation.repositories) ??
		[]
	const selectedRepository = repositories.find(
		(repository) => repository._id === selectedRepositoryId,
	)
	const selectedDraft = drafts?.find(
		({ draft }) => draft._id === selectedDraftId,
	)?.draft

	async function run(
		action: Exclude<BusyAction, null>,
		operation: () => Promise<void>,
	) {
		setBusyAction(action)
		try {
			await operation()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusyAction(null)
		}
	}

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
						Repository selection and plugin detection happen once
						while adding the project.
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
								Install the GitHub App and grant the public
								repository you want to add.
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
								disabled={Boolean(selectedDraft)}
								onValueChange={(value) =>
									setSelectedRepositoryId(
										value as Id<'githubRepositories'> | null,
									)
								}
								value={selectedRepositoryId}
							>
								<SelectTrigger
									className="h-10 w-full"
									id="publishing-repository"
								>
									<SelectValue placeholder="Choose a public repository" />
								</SelectTrigger>
								<SelectContent>
									{repositories.map((repository) => (
										<SelectItem
											key={repository._id}
											value={repository._id}
										>
											{repository.fullName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								className="w-full"
								disabled={
									!selectedRepositoryId ||
									Boolean(selectedDraft) ||
									busyAction !== null
								}
								onClick={() =>
									run('analyze', async () => {
										if (!selectedRepositoryId) {
											return
										}
										const result = await analyzeRepository({
											repositoryId: selectedRepositoryId,
										})
										setSelectedDraftId(result.draftId)
										toast.success(
											`${result.adapterName} detected at ${result.detectionScore}% confidence.`,
										)
									})
								}
							>
								<HugeiconsIcon
									className="size-4"
									icon={Search01Icon}
								/>
								Detect plugin
							</Button>
						</>
					)}
				</CardContent>
			</Card>

			{selectedDraft ? (
				<Card className="shadow-none">
					<CardHeader>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<CardTitle>Confirm project metadata</CardTitle>
								<CardDescription>
									Review the detected plugin information
									before creating the project workspace.
								</CardDescription>
							</div>
							<Badge variant="outline">
								{selectedDraft.detectionScore}% detection
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						<MetadataForm
							busy={busyAction !== null}
							draft={selectedDraft}
							key={`${selectedDraft._id}:${selectedDraft.updatedAt}`}
							onSave={(metadata) =>
								run('metadata', async () => {
									await saveMetadata({
										draftId: selectedDraft._id,
										...metadata,
									})
									toast.success('Project added.')
									if (!selectedRepository) {
										throw new Error(
											'The selected repository is no longer available.',
										)
									}
									router.push(
										`/dashboard/plugins/${createProjectDashboardId(selectedRepository.githubRepositoryId)}` as Route,
									)
								})
							}
							submitLabel="Add project"
						/>
					</CardContent>
				</Card>
			) : (
				<Card className="border-dashed shadow-none">
					<CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
						<span className="grid size-14 place-items-center rounded-md border text-muted-foreground">
							<HugeiconsIcon
								className="size-6"
								icon={Search01Icon}
							/>
						</span>
						<h2 className="mt-5 font-semibold text-lg">
							Select and detect a plugin
						</h2>
						<p className="mt-2 max-w-md text-muted-foreground text-sm">
							Metadata confirmation appears here after
							BedrockNexus recognizes a supported plugin.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

export function ProjectMetadataManager({
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
	const [busy, setBusy] = useState(false)

	if (auth.isLoading || project === undefined) {
		return (
			<p className="text-muted-foreground text-sm">
				Loading project metadata…
			</p>
		)
	}

	const { draft, repository } = project
	return (
		<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Project metadata</CardTitle>
					<CardDescription>
						Edit the catalog information for this plugin. Repository
						selection is fixed during Add Project. Published
						metadata changes are staged until the next release is
						approved.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<MetadataForm
						busy={busy || draft.status === 'inReview'}
						draft={draft}
						key={`${draft._id}:${draft.updatedAt}`}
						onSave={async (metadata) => {
							setBusy(true)
							try {
								await saveMetadata({
									draftId: draft._id,
									...metadata,
								})
								toast.success('Project metadata saved.')
							} catch (error) {
								toast.error(errorMessage(error))
							} finally {
								setBusy(false)
							}
						}}
						submitLabel="Save metadata"
					/>
				</CardContent>
			</Card>
			<div className="space-y-4">
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Project status</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">State</span>
							<Badge variant="outline">
								{statusLabel(draft.status)}
							</Badge>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								Server software
							</span>
							<span>{adapterLabel(draft.adapterId)}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								License
							</span>
							<span>{draft.license ?? 'Not detected'}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								Repository
							</span>
							<a
								className="max-w-44 truncate text-primary hover:underline"
								href={repository.htmlUrl}
								rel="noreferrer"
								target="_blank"
							>
								{repository.fullName}
							</a>
						</div>
					</CardContent>
				</Card>
				{draft.status === 'inReview' ? (
					<Card className="border-primary shadow-none">
						<CardContent className="p-4 text-sm">
							Metadata is locked while this release is awaiting
							moderator review.
						</CardContent>
					</Card>
				) : null}
			</div>
		</div>
	)
}

export function ProjectWorkflowManager({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const auth = useConvexAuth()
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
	const refreshPublishingState = useAction(
		api.functions.plugins.publishing.actions.refreshPublishingState,
	)
	const [busyAction, setBusyAction] = useState<BusyAction>(null)

	if (auth.isLoading || project === undefined || workflows === undefined) {
		return (
			<p className="text-muted-foreground text-sm">
				Loading workflow status…
			</p>
		)
	}
	const { draft, repository } = project
	const selectedWorkflow = workflows.find(
		(workflow) => workflow.key === draft.workflowTemplateKey,
	)

	async function run(
		action: Exclude<BusyAction, null>,
		operation: () => Promise<void>,
	) {
		setBusyAction(action)
		try {
			await operation()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusyAction(null)
		}
	}

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
					<CardTitle>Managed publishing workflow</CardTitle>
					<CardDescription>
						Pick the build workflow for this project. BedrockNexus
						commits the validated workflow directly to{' '}
						<strong>{repository.defaultBranch}</strong>. Installing
						again updates the file to the latest admin-managed
						template.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="space-y-3">
						<Label>Publishing workflow</Label>
						<div className="grid gap-3 sm:grid-cols-2">
							{workflows.map((workflow) => {
								const isSelected =
									workflow.key === draft.workflowTemplateKey
								return (
									<button
										className={
											isSelected
												? 'rounded-md border border-primary bg-primary p-4 text-left text-primary-foreground'
												: 'rounded-md border p-4 text-left transition-colors hover:bg-muted'
										}
										disabled={
											draft.status === 'inReview' ||
											busyAction !== null
										}
										key={workflow.key}
										onClick={() =>
											run('workflow', async () => {
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
											{workflow.buildSystem} ·{' '}
											{workflow.source} · v
											{workflow.version}
										</span>
									</button>
								)
							})}
						</div>
						{draft.workflowInstalled && selectedWorkflow ? (
							<p className="text-muted-foreground text-xs">
								Choosing a different workflow requires
								installing the newly selected template before
								this project can be submitted again.
							</p>
						) : null}
					</div>
					<div className="rounded-md border bg-muted p-4 font-mono text-sm">
						.github/workflows/bedrocknexus-publish.yml
					</div>
					<div className="flex flex-wrap gap-3">
						<Button
							disabled={
								!(
									draft.projectId && draft.workflowTemplateKey
								) ||
								draft.status === 'inReview' ||
								busyAction !== null
							}
							onClick={() =>
								run('workflow', async () => {
									const result = await installWorkflow({
										draftId: draft._id,
									})
									toast.success(
										result.updated
											? `Workflow template v${result.templateVersion} committed.`
											: 'The repository already has the current workflow.',
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
						<Button
							disabled={busyAction !== null}
							onClick={() =>
								run('refresh', async () => {
									await refreshPublishingState({
										draftId: draft._id,
									})
									toast.success(
										'Workflow status refreshed from GitHub.',
									)
								})
							}
							variant="outline"
						>
							<HugeiconsIcon
								className="size-4"
								icon={RefreshIcon}
							/>
							Refresh status
						</Button>
					</div>
				</CardContent>
			</Card>
			<Card className="h-fit shadow-none">
				<CardHeader>
					<CardTitle>Installation status</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					<div className="flex items-center justify-between gap-3">
						<span>Workflow file</span>
						<Badge
							variant={
								draft.workflowInstalled ? 'default' : 'outline'
							}
						>
							{draft.workflowInstalled ? 'Installed' : 'Missing'}
						</Badge>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span>Selected workflow</span>
						<span className="text-right">
							{selectedWorkflow?.label ?? 'Not selected'}
						</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span>Template version</span>
						<span>
							{draft.workflowTemplateVersion ?? 'Not recorded'}
						</span>
					</div>
					{draft.workflowInstalled && draft.workflowCommitSha ? (
						<a
							className="block truncate text-primary hover:underline"
							href={`${repository.htmlUrl}/commit/${encodeURIComponent(draft.workflowCommitSha)}`}
							rel="noreferrer"
							target="_blank"
						>
							Commit {draft.workflowCommitSha.slice(0, 8)}
						</a>
					) : null}
				</CardContent>
			</Card>
		</div>
	)
}

export function ProjectReleaseManager({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const auth = useConvexAuth()
	const project = useQuery(
		api.functions.plugins.publishing.model.getMine,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	const releases = useQuery(
		api.functions.plugins.publishing.model.listDetectedReleases,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	const refreshPublishingState = useAction(
		api.functions.plugins.publishing.actions.refreshPublishingState,
	)
	const selectDetectedRelease = useMutation(
		api.functions.plugins.publishing.model.selectDetectedRelease,
	)
	const submitForReview = useMutation(
		api.functions.plugins.publishing.model.submitForReview,
	)
	const [busyAction, setBusyAction] = useState<BusyAction>(null)

	if (auth.isLoading || project === undefined || releases === undefined) {
		return (
			<p className="text-muted-foreground text-sm">Loading releases…</p>
		)
	}
	const { draft } = project
	const selectedRelease = releases.find(
		(release) => release.githubReleaseId === draft.latestReleaseId,
	)

	async function run(
		action: Exclude<BusyAction, null>,
		operation: () => Promise<void>,
	) {
		setBusyAction(action)
		try {
			await operation()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusyAction(null)
		}
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<Card className="shadow-none">
				<CardHeader>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<CardTitle>GitHub releases</CardTitle>
							<CardDescription>
								Detect verified tagged builds and choose the
								exact release to submit for review.
							</CardDescription>
						</div>
						<Button
							disabled={
								!draft.workflowInstalled || busyAction !== null
							}
							onClick={() =>
								run('refresh', async () => {
									const result = await refreshPublishingState(
										{ draftId: draft._id },
									)
									toast.success(
										result.verifiedBuild
											? 'Verified GitHub releases refreshed.'
											: 'No new verified release was found.',
									)
								})
							}
							variant="outline"
						>
							<HugeiconsIcon
								className="size-4"
								icon={RefreshIcon}
							/>
							Refresh GitHub
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{releases.length === 0 ? (
						<div className="rounded-md border border-dashed p-8 text-center">
							<HugeiconsIcon
								className="mx-auto size-7 text-muted-foreground"
								icon={Package01Icon}
							/>
							<p className="mt-3 font-medium">
								No eligible release detected
							</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Install the workflow, push a v* tag, and refresh
								GitHub.
							</p>
						</div>
					) : (
						releases.map((release) => {
							const selected =
								release.githubReleaseId ===
								draft.latestReleaseId
							return (
								<div
									className={cn(
										'flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center',
										selected && 'border-primary',
									)}
									key={release.releaseId}
								>
									<span
										className={cn(
											'grid size-10 shrink-0 place-items-center rounded-md border',
											selected &&
												'bg-primary text-primary-foreground',
										)}
									>
										<HugeiconsIcon
											className="size-4"
											icon={Package01Icon}
										/>
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<a
												className="font-semibold hover:text-primary"
												href={release.releaseUrl}
												rel="noreferrer"
												target="_blank"
											>
												{release.tagName}
											</a>
											<Badge
												variant={
													release.verifiedBuild
														? 'default'
														: 'outline'
												}
											>
												{release.status}
											</Badge>
										</div>
										<p className="mt-1 truncate text-muted-foreground text-sm">
											{release.assetName ??
												'No primary asset'}
										</p>
									</div>
									<Button
										disabled={
											release.status !== 'verified' ||
											draft.status === 'inReview' ||
											busyAction !== null
										}
										onClick={() =>
											run('release', async () => {
												await selectDetectedRelease({
													draftId: draft._id,
													releaseId:
														release.releaseId,
												})
												toast.success(
													`${release.tagName} selected.`,
												)
											})
										}
										size="sm"
										variant={
											selected ? 'default' : 'outline'
										}
									>
										{selected ? 'Selected' : 'Select'}
									</Button>
								</div>
							)
						})
					)}
				</CardContent>
			</Card>
			<div className="space-y-4">
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Review submission</CardTitle>
						<CardDescription>
							A moderator must approve the selected release before
							it becomes public.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between gap-3 text-sm">
							<span>Selected release</span>
							<span className="font-medium">
								{selectedRelease?.tagName ?? 'None'}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3 text-sm">
							<span>Verified build</span>
							<Badge
								variant={
									draft.verifiedBuild ? 'default' : 'outline'
								}
							>
								{draft.verifiedBuild
									? 'Verified'
									: 'Not verified'}
							</Badge>
						</div>
						{draft.reviewNotes ? (
							<div className="rounded-md border bg-muted p-3 text-sm">
								<p className="font-medium">Moderator note</p>
								<p className="mt-1 text-muted-foreground">
									{draft.reviewNotes}
								</p>
							</div>
						) : null}
						<Button
							className="w-full"
							disabled={
								draft.status === 'published' ||
								draft.status === 'inReview' ||
								!draft.verifiedBuild ||
								!draft.moderationReady ||
								busyAction !== null
							}
							onClick={() =>
								run('submit', async () => {
									await submitForReview({
										draftId: draft._id,
									})
									toast.success(
										'Release submitted for moderator review.',
									)
								})
							}
						>
							{draft.status === 'published'
								? 'Published'
								: draft.status === 'inReview'
									? 'Awaiting review'
									: draft.status === 'changesRequested'
										? 'Resubmit for review'
										: 'Submit for review'}
						</Button>
					</CardContent>
				</Card>
				<Card className="shadow-none">
					<CardContent className="flex items-start gap-3 p-4 text-sm">
						<HugeiconsIcon
							className="mt-0.5 size-5 shrink-0 text-primary"
							icon={CheckmarkCircle02Icon}
						/>
						Verified Build confirms workflow provenance and artifact
						correlation. It is not a malware or safety review.
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
