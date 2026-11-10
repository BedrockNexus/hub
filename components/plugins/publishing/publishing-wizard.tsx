'use client'

import {
	GitBranchIcon,
	GithubIcon,
	Package01Icon,
	RefreshIcon,
	WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	CreateListingFooter,
	CreateListingShell,
} from '@/components/user-dashboard/create/create-listing-shell'
import { PluginReviewNotice } from '@/components/user-dashboard/plugins/edit/plugin-edit-data'
import { SettingsSection } from '@/components/user-dashboard/settings-section'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { useMinute } from '@/hooks/use-minute'
import { formatBytes, formatRegistryDate } from '@/lib/plugins/format-registry'
import { createPluginDashboardId } from '@/lib/plugins/plugin-dashboard-id'
import {
	CHANGELOG_MAX_LENGTH,
	releaseSubmissionSchema,
	releaseTagFor,
} from '@/lib/plugins/publishing/metadata'
import { userFacingError } from '@/lib/user-facing-error'

type ReleaseStatus = Doc<'pluginReleases'>['status']

const releaseStatusLabels: Record<ReleaseStatus, string> = {
	preparing: 'Copying build',
	preparationFailed: 'Copy failed',
	inReview: 'Awaiting review',
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
	return userFacingError(error, 'Something went wrong.')
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

/**
 * Creating a plugin: pick a public repository the GitHub App can read. The
 * draft's name, summary and description are filled in from the repository
 * and can be changed from the plugin's dashboard; the next step is choosing
 * a build workflow.
 */
export function AddPluginFlow() {
	const auth = useConvexAuth()
	const router = useRouter()
	const installations = useQuery(
		api.functions.plugins.github.installations.listMine,
		auth.isAuthenticated ? {} : 'skip',
	)
	const startFromRepository = useAction(
		api.functions.plugins.publishing.actions.startFromRepository,
	)
	const [repositoryId, setRepositoryId] =
		useState<Id<'githubRepositories'> | null>(null)
	const { busy, run } = useBusy()
	const repositories = (
		installations?.flatMap((installation) => installation.repositories) ??
		[]
	).filter(
		(repository) =>
			!repository.isPrivate && repository.accessStatus === 'granted',
	)

	return (
		<CreateListingShell
			intro="Pick the repository to publish from. We fill in the name, summary and description from it, and you can change them after."
			kind="plugin"
			showPlugins
		>
			{auth.isLoading || installations === undefined ? (
				<p className="text-muted-foreground text-sm" role="status">
					Loading repositories...
				</p>
			) : repositories.length === 0 ? (
				<div className="flex flex-col items-start gap-4 rounded-lg border bg-card p-5">
					<div className="space-y-1">
						<h2 className="font-semibold">Connect GitHub</h2>
						<p className="text-muted-foreground text-sm">
							Install the BedrockNexus GitHub App and give it
							access to the public repository you want to publish.
						</p>
					</div>
					<a className={buttonVariants()} href="/api/github/install">
						<HugeiconsIcon className="size-4" icon={GithubIcon} />
						Install GitHub App
					</a>
				</div>
			) : (
				<form
					className="flex flex-col gap-9"
					onSubmit={(event) => {
						event.preventDefault()
						const repository = repositories.find(
							(item) => item._id === repositoryId,
						)
						if (!repository || busy !== null) {
							return
						}
						void run('start', async () => {
							await startFromRepository({
								repositoryId: repository._id,
							})
							router.push(
								`/dashboard/plugins/${createPluginDashboardId(repository.githubRepositoryId)}/workflow` as Route,
							)
						})
					}}
				>
					<fieldset className="flex flex-col gap-3">
						<div className="flex items-baseline justify-between gap-3">
							<legend className="font-medium text-sm">
								Repository
							</legend>
							<a
								className="text-primary text-sm hover:underline"
								href="/api/github/install"
							>
								Add another repository
							</a>
						</div>
						<div className="overflow-hidden rounded-lg border bg-card">
							{repositories.map((item) => (
								<label
									className="flex cursor-pointer items-center gap-3 border-t px-4 py-3.5 first:border-t-0 has-checked:bg-muted/40"
									key={item._id}
								>
									<input
										checked={repositoryId === item._id}
										className="size-4 accent-primary"
										disabled={busy !== null}
										name="repository"
										onChange={() =>
											setRepositoryId(item._id)
										}
										type="radio"
										value={item._id}
									/>
									<span className="min-w-0 truncate font-mono text-sm">
										{item.fullName}
									</span>
								</label>
							))}
						</div>
					</fieldset>

					<CreateListingFooter note="Next: pick a build workflow, then the rest of the listing.">
						<Link
							className={buttonVariants({ variant: 'ghost' })}
							href="/dashboard/plugins"
						>
							Cancel
						</Link>
						<Button
							disabled={!repositoryId || busy !== null}
							type="submit"
						>
							{busy === 'start'
								? 'Reading repository...'
								: 'Create draft'}
						</Button>
					</CreateListingFooter>
				</form>
			)}
		</CreateListingShell>
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
	const versionsHref = pathname.replace(/\/workflow$/, '/versions') as Route

	return (
		<SettingsSection
			description={`Pick the workflow for your plugin’s server software. BedrockNexus commits it to ${repository.defaultBranch}, and from then on every push builds your plugin on GitHub. Installing again updates it to the newest version`}
			title="Workflow"
		>
			<PluginReviewNotice plugin={project} />
			<div className="space-y-5">
				{workflows.length === 0 ? (
					<p className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
						No build workflow is available yet. BedrockNexus admins
						add them; check back soon.
					</p>
				) : null}
				{workflows.length > 0 ? (
					<div className="max-w-lg space-y-2">
						<Label htmlFor="publishing-workflow">
							Build workflow
						</Label>
						<Select
							disabled={project.locked || busy !== null}
							items={workflows.map((workflow) => ({
								value: workflow.key,
								label: `${workflow.softwareName}: ${workflow.label}`,
							}))}
							onValueChange={(key) => {
								if (!key || key === draft.workflowTemplateKey) {
									return
								}
								void run('select', async () => {
									await selectWorkflow({
										draftId: draft._id,
										key,
									})
								})
							}}
							value={selectedWorkflow?.key ?? null}
						>
							<SelectTrigger
								className="w-full"
								id="publishing-workflow"
							>
								<SelectValue placeholder="Choose a workflow" />
							</SelectTrigger>
							<SelectContent>
								{softwareNames.map((softwareName) => (
									<SelectGroup key={softwareName}>
										<SelectLabel>
											{softwareName}
										</SelectLabel>
										{workflows
											.filter(
												(workflow) =>
													workflow.softwareName ===
													softwareName,
											)
											.map((workflow) => (
												<SelectItem
													key={workflow.key}
													value={workflow.key}
												>
													{workflow.label}
												</SelectItem>
											))}
									</SelectGroup>
								))}
							</SelectContent>
						</Select>
						{selectedWorkflow ? (
							<p className="text-muted-foreground text-xs">
								Version {selectedWorkflow.version}
							</p>
						) : null}
					</div>
				) : null}

				<div className="rounded-md border bg-muted p-4 font-mono text-sm">
					.github/workflows/bedrocknexus-publish.yml
				</div>
				<div className="flex flex-wrap gap-3">
					<Button
						disabled={
							!(draft.projectId && draft.workflowTemplateKey) ||
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
							href={versionsHref}
						>
							See builds
						</Link>
					) : null}
				</div>
			</div>
			<div className="space-y-4 rounded-md border p-4 text-sm">
				<h3 className="font-medium">Status</h3>
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
					Builds made after the workflow file is edited in your
					repository cannot be published.
				</p>
			</div>
		</SettingsSection>
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
				<Label id={`changelog-${build.buildId}`}>Changelog</Label>
				<MarkdownEditor
					disabled={busy}
					labelledBy={`changelog-${build.buildId}`}
					maxLength={CHANGELOG_MAX_LENGTH}
					minHeight="9rem"
					onChange={setChangelog}
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
		<SettingsSection
			description="Every push builds your plugin. Pick a build, give it a version and write what changed, then send it to moderator review"
			title="Versions"
		>
			<PluginReviewNotice plugin={project} />
			<ol className="list-decimal space-y-1 pl-5 text-muted-foreground text-sm">
				<li>
					Pick a build, give it a version number and write what
					changed.
				</li>
				<li>
					BedrockNexus copies the file from GitHub, so the file
					reviewed is the file published.
				</li>
				<li>A moderator approves it and the version goes live.</li>
				<li>
					BedrockNexus creates the GitHub release{' '}
					<code>v&#123;version&#125;</code> on that commit with the
					file attached.
				</li>
			</ol>
			<section className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 className="font-semibold">Builds</h3>
						<p className="text-muted-foreground text-sm">
							Every push to {repository.fullName} builds your
							plugin.
						</p>
					</div>
					<Button
						disabled={!draft.workflowInstalled || busy !== null}
						onClick={() =>
							run('sync', async () => {
								await syncBuilds({ draftId: draft._id })
								toast.success('Builds refreshed from GitHub.')
							})
						}
						variant="outline"
					>
						<HugeiconsIcon className="size-4" icon={RefreshIcon} />
						Refresh
					</Button>
				</div>
				{draft.workflowInstalled ? (
					builds.length === 0 ? (
						<div className="rounded-md border border-dashed p-8 text-center">
							<HugeiconsIcon
								className="mx-auto size-7 text-muted-foreground"
								icon={Package01Icon}
							/>
							<p className="mt-3 font-medium">No builds yet</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Push a commit to your repository. Builds appear
								here when GitHub starts them.
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
												{build.commitSha.slice(0, 7)}
											</a>
											{build.branch ? (
												<span className="inline-flex items-center gap-1">
													<HugeiconsIcon
														className="size-3"
														icon={GitBranchIcon}
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
												{build.release.version} ·{' '}
												{
													releaseStatusLabels[
														build.release.status
													]
												}
											</Badge>
										) : null}
										{build.status === 'completed' ? (
											build.conclusion === 'success' ? (
												build.traceable ? (
													<Badge>Built</Badge>
												) : (
													<Badge variant="outline">
														Workflow edited
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
												(build.release !== null &&
													!reusableStatuses.has(
														build.release.status,
													))
											}
											onClick={() =>
												setOpenBuildId(build.buildId)
											}
											size="sm"
											title={build.unpublishableReason}
										>
											Review &amp; submit
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
										onCancel={() => setOpenBuildId(null)}
										onSubmit={(input) =>
											run('submit', async () => {
												await submitRelease({
													draftId: draft._id,
													buildId: build.buildId,
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
			</section>
			<section className="space-y-3">
				<div>
					<h3 className="font-semibold">Sent to review</h3>
					<p className="text-muted-foreground text-sm">
						Builds you sent to review, newest first.
					</p>
				</div>
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
											: release.status === 'rejected' ||
													release.status ===
														'preparationFailed'
												? 'destructive'
												: 'outline'
									}
								>
									{releaseStatusLabels[release.status]}
								</Badge>
							</div>
							<p className="mt-1 text-muted-foreground text-xs">
								Build {release.commitSha.slice(0, 7)}
								{release.branch ? ` on ${release.branch}` : ''}{' '}
								· sent {formatRegistryDate(release.submittedAt)}
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
											href={release.githubReleaseUrl}
											rel="noreferrer"
											target="_blank"
										>
											GitHub release{' '}
											{releaseTagFor(release.version)}
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
													run('github', async () => {
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
													})
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
			</section>
		</SettingsSection>
	)
}
