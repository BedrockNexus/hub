'use client'

import {
	Add01Icon,
	Delete02Icon,
	RefreshIcon,
	WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
	getWorkflowTemplateValidationError,
	YamlWorkflowEditor,
} from '@/components/plugins/editors/yaml-workflow-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

type AdapterId = 'pocketmine-mp' | 'powernukkitx'
type BuildSystem = 'composer' | 'gradle' | 'maven'

interface NewWorkflow {
	label: string
	adapterId: AdapterId
	buildSystem: BuildSystem
	content: string
}

function errorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: 'The workflow template update failed.'
}

function defaultBuildSystem(adapterId: AdapterId): BuildSystem {
	return adapterId === 'pocketmine-mp' ? 'composer' : 'gradle'
}

export function WorkflowTemplateEditor() {
	const auth = useConvexAuth()
	const templates = useQuery(
		api.functions.plugins.workflowTemplates.list,
		auth.isAuthenticated ? {} : 'skip',
	)
	const createTemplate = useMutation(
		api.functions.plugins.workflowTemplates.create,
	)
	const saveTemplate = useMutation(
		api.functions.plugins.workflowTemplates.save,
	)
	const resetTemplate = useMutation(
		api.functions.plugins.workflowTemplates.reset,
	)
	const removeTemplate = useMutation(
		api.functions.plugins.workflowTemplates.remove,
	)
	const [selectedKey, setSelectedKey] = useState<string>('')
	const [content, setContent] = useState('')
	const [adding, setAdding] = useState(false)
	const [newWorkflow, setNewWorkflow] = useState<NewWorkflow>({
		label: '',
		adapterId: 'pocketmine-mp',
		buildSystem: 'composer',
		content: '',
	})
	const [busy, setBusy] = useState(false)
	const selected =
		templates?.find((template) => template.key === selectedKey) ??
		(selectedKey ? undefined : templates?.[0])

	useEffect(() => {
		if (!selected || adding) {
			return
		}
		setSelectedKey(selected.key)
		setContent(selected.content)
	}, [adding, selected])

	if (auth.isLoading || templates === undefined || !selected) {
		return (
			<p className="text-muted-foreground text-sm">
				Loading workflow templates…
			</p>
		)
	}

	function starterContent(adapterId: AdapterId, buildSystem: BuildSystem) {
		return (
			templates?.find(
				(template) =>
					template.adapterId === adapterId &&
					template.buildSystem === buildSystem &&
					template.source !== 'custom',
			)?.content ?? ''
		)
	}

	function beginAdding() {
		const adapterId = 'pocketmine-mp' as const
		const buildSystem = 'composer' as const
		setNewWorkflow({
			label: '',
			adapterId,
			buildSystem,
			content: starterContent(adapterId, buildSystem),
		})
		setAdding(true)
	}

	function updateNewWorkflowAdapter(adapterId: AdapterId) {
		const buildSystem = defaultBuildSystem(adapterId)
		setNewWorkflow((current) => ({
			...current,
			adapterId,
			buildSystem,
			content: starterContent(adapterId, buildSystem),
		}))
	}

	function updateNewWorkflowBuildSystem(buildSystem: BuildSystem) {
		setNewWorkflow((current) => ({
			...current,
			buildSystem,
			content: starterContent(current.adapterId, buildSystem),
		}))
	}

	const changed = content !== selected.content
	const contentError = getWorkflowTemplateValidationError(content)
	const newWorkflowError = getWorkflowTemplateValidationError(
		newWorkflow.content,
	)

	return (
		<div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
			<Card className="h-fit shadow-none">
				<CardHeader>
					<span className="mb-3 grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
						<HugeiconsIcon
							className="size-5"
							icon={WorkflowSquare01Icon}
						/>
					</span>
					<CardTitle>Workflow variants</CardTitle>
					<CardDescription>
						Publishers choose from these validated workflows for
						compatible projects.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					<Button
						className="mb-2 w-full"
						onClick={beginAdding}
						variant="outline"
					>
						<HugeiconsIcon className="size-4" icon={Add01Icon} />
						Add workflow
					</Button>
					{templates.map((template) => (
						<button
							className={
								!adding && template.key === selected.key
									? 'flex w-full flex-col rounded-md bg-primary p-3 text-left text-primary-foreground'
									: 'flex w-full flex-col rounded-md border p-3 text-left hover:bg-muted'
							}
							key={template.key}
							onClick={() => {
								setAdding(false)
								setSelectedKey(template.key)
								setContent(template.content)
							}}
							type="button"
						>
							<span className="font-medium text-sm">
								{template.label}
							</span>
							<span
								className={
									!adding && template.key === selected.key
										? 'mt-1 text-primary-foreground/80 text-xs'
										: 'mt-1 text-muted-foreground text-xs'
								}
							>
								{template.buildSystem} · {template.source} ·
								version {template.version}
							</span>
						</button>
					))}
				</CardContent>
			</Card>

			{adding ? (
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Add workflow</CardTitle>
						<CardDescription>
							Create another validated publishing option that
							project owners can select.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="space-y-5"
							onSubmit={async (event) => {
								event.preventDefault()
								setBusy(true)
								try {
									const result =
										await createTemplate(newWorkflow)
									setAdding(false)
									setSelectedKey(result.key)
									toast.success(
										'Workflow created and made available to publishers.',
									)
								} catch (error) {
									toast.error(errorMessage(error))
								} finally {
									setBusy(false)
								}
							}}
						>
							<div className="space-y-2">
								<Label htmlFor="new-workflow-label">
									Workflow name
								</Label>
								<Input
									id="new-workflow-label"
									onChange={(event) =>
										setNewWorkflow((current) => ({
											...current,
											label: event.target.value,
										}))
									}
									placeholder="PowerNukkitX · Gradle with tests"
									value={newWorkflow.label}
								/>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="new-workflow-adapter">
										Server software
									</Label>
									<Select
										onValueChange={(value) =>
											updateNewWorkflowAdapter(
												value as AdapterId,
											)
										}
										value={newWorkflow.adapterId}
									>
										<SelectTrigger
											className="w-full"
											id="new-workflow-adapter"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="pocketmine-mp">
												PocketMine-MP
											</SelectItem>
											<SelectItem value="powernukkitx">
												PowerNukkitX
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="new-workflow-build-system">
										Build system
									</Label>
									<Select
										onValueChange={(value) =>
											updateNewWorkflowBuildSystem(
												value as BuildSystem,
											)
										}
										value={newWorkflow.buildSystem}
									>
										<SelectTrigger
											className="w-full"
											id="new-workflow-build-system"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{newWorkflow.adapterId ===
											'pocketmine-mp' ? (
												<SelectItem value="composer">
													Composer
												</SelectItem>
											) : (
												<>
													<SelectItem value="gradle">
														Gradle
													</SelectItem>
													<SelectItem value="maven">
														Maven
													</SelectItem>
												</>
											)}
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="space-y-2">
								<Label id="new-workflow-template-label">
									GitHub Actions YAML
								</Label>
								<YamlWorkflowEditor
									labelledBy="new-workflow-template-label"
									onChange={(value) =>
										setNewWorkflow((current) => ({
											...current,
											content: value,
										}))
									}
									value={newWorkflow.content}
								/>
							</div>
							<div className="rounded-md border bg-muted p-3 text-muted-foreground text-sm">
								The new workflow must keep the{' '}
								<code className="text-foreground">
									{'{{package_name}}'}
								</code>{' '}
								placeholder and pass the same permission,
								trigger, secret, and runner checks as the
								built-in workflows.
							</div>
							<div className="flex justify-end gap-2">
								<Button
									disabled={busy}
									onClick={() => setAdding(false)}
									type="button"
									variant="outline"
								>
									Cancel
								</Button>
								<Button
									disabled={
										busy ||
										!newWorkflow.label.trim() ||
										newWorkflowError !== null
									}
									type="submit"
								>
									<HugeiconsIcon
										className="size-4"
										icon={Add01Icon}
									/>
									Add workflow
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			) : (
				<Card className="shadow-none">
					<CardHeader>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<CardTitle>{selected.label}</CardTitle>
								<CardDescription>
									Saved content is used when a publisher
									installs or updates this workflow.
								</CardDescription>
							</div>
							<div className="flex gap-2">
								<Badge variant="outline">
									{selected.source}
								</Badge>
								<Badge variant="outline">
									v{selected.version}
								</Badge>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label id="workflow-template-label">
								GitHub Actions YAML
							</Label>
							<YamlWorkflowEditor
								labelledBy="workflow-template-label"
								minHeight="36rem"
								onChange={setContent}
								value={content}
							/>
						</div>
						<div className="rounded-md border bg-muted p-3 text-muted-foreground text-sm">
							Keep the{' '}
							<code className="text-foreground">
								{'{{package_name}}'}
							</code>{' '}
							placeholder. The backend also validates release
							gating, GitHub Release creation, and least-privilege
							permissions before saving.
						</div>
						<div className="flex flex-wrap justify-end gap-2">
							{selected.source === 'custom' ? (
								<Button
									disabled={busy}
									onClick={async () => {
										if (
											!window.confirm(
												`Delete "${selected.label}"? It will no longer be available to publishers.`,
											)
										) {
											return
										}
										setBusy(true)
										try {
											await removeTemplate({
												key: selected.key,
											})
											setSelectedKey('')
											toast.success(
												'Custom workflow deleted.',
											)
										} catch (error) {
											toast.error(errorMessage(error))
										} finally {
											setBusy(false)
										}
									}}
									variant="destructive"
								>
									<HugeiconsIcon
										className="size-4"
										icon={Delete02Icon}
									/>
									Delete workflow
								</Button>
							) : (
								<Button
									disabled={
										busy || selected.source === 'default'
									}
									onClick={async () => {
										setBusy(true)
										try {
											await resetTemplate({
												key: selected.key,
											})
											toast.success(
												'Workflow restored to the code-defined default.',
											)
										} catch (error) {
											toast.error(errorMessage(error))
										} finally {
											setBusy(false)
										}
									}}
									variant="outline"
								>
									<HugeiconsIcon
										className="size-4"
										icon={RefreshIcon}
									/>
									Restore default
								</Button>
							)}
							<Button
								disabled={
									busy || !changed || contentError !== null
								}
								onClick={async () => {
									setBusy(true)
									try {
										const result = await saveTemplate({
											key: selected.key,
											content,
										})
										toast.success(
											`Workflow template version ${result.version} saved.`,
										)
									} catch (error) {
										toast.error(errorMessage(error))
									} finally {
										setBusy(false)
									}
								}}
							>
								Save workflow
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
