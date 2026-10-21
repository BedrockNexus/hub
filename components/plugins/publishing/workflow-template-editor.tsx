'use client'

import {
	Add01Icon,
	Delete02Icon,
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
import type { Id } from '@/convex/_generated/dataModel'

interface NewWorkflow {
	label: string
	softwareId: Id<'serverSoftware'> | null
	content: string
}

function errorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: 'The workflow template update failed.'
}

export function WorkflowTemplateEditor() {
	const auth = useConvexAuth()
	const templates = useQuery(
		api.functions.plugins.workflowTemplates.list,
		auth.isAuthenticated ? {} : 'skip',
	)
	const software = useQuery(
		api.functions.servers.software.listAdmin,
		auth.isAuthenticated ? {} : 'skip',
	)
	const pluginSoftware = software ?? []
	const createTemplate = useMutation(
		api.functions.plugins.workflowTemplates.create,
	)
	const saveTemplate = useMutation(
		api.functions.plugins.workflowTemplates.save,
	)
	const removeTemplate = useMutation(
		api.functions.plugins.workflowTemplates.remove,
	)
	const [selectedKey, setSelectedKey] = useState<string>('')
	const [content, setContent] = useState('')
	const [adding, setAdding] = useState(false)
	const [newWorkflow, setNewWorkflow] = useState<NewWorkflow>({
		label: '',
		softwareId: null,
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

	if (auth.isLoading || templates === undefined || software === undefined) {
		return (
			<p className="text-muted-foreground text-sm">
				Loading workflow templates…
			</p>
		)
	}

	// A new workflow starts as a copy of an existing one for the same
	// software, when there is one.
	function starterContent(softwareId: Id<'serverSoftware'> | null) {
		return (
			templates?.find((template) => template.softwareId === softwareId)
				?.content ?? ''
		)
	}

	function beginAdding() {
		const softwareId = pluginSoftware[0]?._id ?? null
		setNewWorkflow({
			label: '',
			softwareId,
			content: starterContent(softwareId),
		})
		setAdding(true)
	}

	function updateNewWorkflowSoftware(softwareId: Id<'serverSoftware'>) {
		setNewWorkflow((current) => ({
			...current,
			softwareId,
			content: current.content || starterContent(softwareId),
		}))
	}

	const changed = selected ? content !== selected.content : false
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
						Publishers pick one of these when adding a plugin, and
						it sets the plugin's server software. Plugins can be
						published for a software once it has a workflow here.
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
								!adding && template.key === selected?.key
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
									!adding && template.key === selected?.key
										? 'mt-1 text-primary-foreground/80 text-xs'
										: 'mt-1 text-muted-foreground text-xs'
								}
							>
								{template.softwareName} · version{' '}
								{template.version}
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
							plugin developers can select.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="space-y-5"
							onSubmit={async (event) => {
								event.preventDefault()
								setBusy(true)
								try {
									if (!newWorkflow.softwareId) {
										return
									}
									const result = await createTemplate({
										label: newWorkflow.label,
										softwareId: newWorkflow.softwareId,
										content: newWorkflow.content,
									})
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
									placeholder="PowerNukkitX · Gradle"
									value={newWorkflow.label}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="new-workflow-software">
									Server software
								</Label>
								{pluginSoftware.length === 0 ? (
									<p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
										No server software yet. Add one in
										Server software first.
									</p>
								) : (
									<Select
										items={pluginSoftware.map((item) => ({
											value: item._id,
											label: item.name,
										}))}
										onValueChange={(value) =>
											updateNewWorkflowSoftware(
												value as Id<'serverSoftware'>,
											)
										}
										value={newWorkflow.softwareId}
									>
										<SelectTrigger
											className="w-full"
											id="new-workflow-software"
										>
											<SelectValue placeholder="Choose software" />
										</SelectTrigger>
										<SelectContent>
											{pluginSoftware.map((item) => (
												<SelectItem
													key={item._id}
													value={item._id}
												>
													{item.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
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
								placeholder, build on push but never on tags,
								upload the plugin as a{' '}
								<code className="text-foreground">
									plugin-package
								</code>{' '}
								artifact, and only read the repository.
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
										!newWorkflow.softwareId ||
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
			) : selected ? (
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
							<Badge variant="outline">v{selected.version}</Badge>
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
							placeholder and upload the built plugin as a{' '}
							<code className="text-foreground">
								plugin-package
							</code>{' '}
							artifact. Workflows only build: they cannot run on
							tags, write to the repository, or read secrets.
							BedrockNexus creates the GitHub release after a
							version is approved.
						</div>
						<div className="flex flex-wrap justify-end gap-2">
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
										toast.success('Workflow deleted.')
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
			) : (
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>No publishing workflows yet</CardTitle>
						<CardDescription>
							Add one for each server software publishers can use.
							Until then nobody can publish a plugin for it.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={beginAdding}>
							<HugeiconsIcon
								className="size-4"
								icon={Add01Icon}
							/>
							Add workflow
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
