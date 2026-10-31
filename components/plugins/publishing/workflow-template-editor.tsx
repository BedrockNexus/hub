'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton'
import {
	getWorkflowTemplateValidationError,
	YamlWorkflowEditor,
} from '@/components/plugins/editors/yaml-workflow-editor'
import {
	type WorkflowTemplate,
	WorkflowTemplatesTable,
} from '@/components/plugins/publishing/workflow-templates-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
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
	const selected = templates?.find((template) => template.key === selectedKey)
	const beginEditing = useCallback((template: WorkflowTemplate) => {
		setAdding(false)
		setSelectedKey(template.key)
		setContent(template.content)
	}, [])

	if (auth.isLoading || templates === undefined || software === undefined) {
		return (
			<DataTableSkeleton columnCount={5} filterCount={2} rowCount={5} />
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
		setSelectedKey('')
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
		<div className="min-w-0">
			<WorkflowTemplatesTable
				onAdd={beginAdding}
				onEdit={beginEditing}
				templates={templates}
			/>
			<Dialog
				onOpenChange={(open) => {
					if (!(open || busy)) {
						setAdding(false)
						setSelectedKey('')
					}
				}}
				open={adding || Boolean(selected)}
			>
				<DialogContent
					className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
					showCloseButton={!busy}
				>
					{adding ? (
						<>
							<DialogHeader className="pr-8">
								<DialogTitle>Add workflow template</DialogTitle>
								<DialogDescription>
									Create another validated publishing option
									that plugin developers can select.
								</DialogDescription>
							</DialogHeader>
							<div>
								<form
									className="space-y-5"
									onSubmit={async (event) => {
										event.preventDefault()
										setBusy(true)
										try {
											if (!newWorkflow.softwareId) {
												return
											}
											await createTemplate({
												label: newWorkflow.label,
												softwareId:
													newWorkflow.softwareId,
												content: newWorkflow.content,
											})
											setAdding(false)
											setSelectedKey('')
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
											disabled={busy}
											id="new-workflow-label"
											maxLength={80}
											minLength={3}
											onChange={(event) =>
												setNewWorkflow((current) => ({
													...current,
													label: event.target.value,
												}))
											}
											placeholder="PowerNukkitX · Gradle"
											required
											value={newWorkflow.label}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="new-workflow-software">
											Server software
										</Label>
										{pluginSoftware.length === 0 ? (
											<p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
												No server software yet. Add one
												in Server software first.
											</p>
										) : (
											<Select
												disabled={busy}
												items={pluginSoftware.map(
													(item) => ({
														value: item._id,
														label: item.name,
													}),
												)}
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
													{pluginSoftware.map(
														(item) => (
															<SelectItem
																key={item._id}
																value={item._id}
															>
																{item.name}
															</SelectItem>
														),
													)}
												</SelectContent>
											</Select>
										)}
									</div>
									<div className="space-y-2">
										<Label id="new-workflow-template-label">
											GitHub Actions YAML
										</Label>
										<YamlWorkflowEditor
											disabled={busy}
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
										placeholder, build on push but never on
										tags, upload the plugin as a{' '}
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
							</div>
						</>
					) : selected ? (
						<>
							<DialogHeader className="pr-8">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<DialogTitle>
											{selected.label}
										</DialogTitle>
										<DialogDescription>
											Saved content is used when a
											publisher installs or updates this
											workflow.
										</DialogDescription>
									</div>
									<Badge variant="outline">
										v{selected.version}
									</Badge>
								</div>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label id="workflow-template-label">
										GitHub Actions YAML
									</Label>
									<YamlWorkflowEditor
										disabled={busy}
										labelledBy="workflow-template-label"
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
									artifact. Workflows only build: they cannot
									run on tags, write to the repository, or
									read secrets. BedrockNexus creates the
									GitHub release after a version is approved.
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
												toast.success(
													'Workflow deleted.',
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
									<Button
										disabled={
											busy ||
											!changed ||
											contentError !== null
										}
										onClick={async () => {
											setBusy(true)
											try {
												const result =
													await saveTemplate({
														key: selected.key,
														content,
													})
												setSelectedKey('')
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
							</div>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	)
}
