'use client'

import { Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton'
import {
	getWorkflowTemplateValidationError,
	YamlWorkflowEditor,
} from '@/components/plugins/editors/yaml-workflow-editor'
import { WorkflowTemplatesTable } from '@/components/plugins/publishing/workflow-templates-table'
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

// The YAML editor gets the height the window leaves after the header, fields,
// notice, buttons and the dialog's padding and margin, so the dialog fits
// without scrolling. Fields stack on narrow screens, which takes more room.
const EDITOR_HEIGHT = 'var(--workflow-editor-height)'
const EDITOR_HEIGHT_CLASSES =
	'[--workflow-editor-height:clamp(10rem,calc(100dvh-36rem),36rem)] sm:[--workflow-editor-height:clamp(12rem,calc(100dvh-27rem),36rem)]'

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
	const [adding, setAdding] = useState(false)
	const [newWorkflow, setNewWorkflow] = useState<NewWorkflow>({
		label: '',
		softwareId: null,
		content: '',
	})
	const [busy, setBusy] = useState(false)
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
		setAdding(true)
	}

	function updateNewWorkflowSoftware(softwareId: Id<'serverSoftware'>) {
		setNewWorkflow((current) => ({
			...current,
			softwareId,
			content: current.content || starterContent(softwareId),
		}))
	}

	const newWorkflowError = getWorkflowTemplateValidationError(
		newWorkflow.content,
	)

	return (
		<div className="min-w-0">
			<WorkflowTemplatesTable onAdd={beginAdding} templates={templates} />
			<Dialog
				onOpenChange={(open) => {
					if (!(open || busy)) {
						setAdding(false)
					}
				}}
				open={adding}
			>
				<DialogContent
					className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(56rem,calc(100%-2rem))]"
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
							<div className={`min-w-0 ${EDITOR_HEIGHT_CLASSES}`}>
								<form
									className="min-w-0 space-y-4"
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
									<div className="grid gap-4 sm:grid-cols-2">
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
													setNewWorkflow(
														(current) => ({
															...current,
															label: event.target
																.value,
														}),
													)
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
													No server software yet. Add
													one in Server software
													first.
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
													value={
														newWorkflow.softwareId
													}
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
																	key={
																		item._id
																	}
																	value={
																		item._id
																	}
																>
																	{item.name}
																</SelectItem>
															),
														)}
													</SelectContent>
												</Select>
											)}
										</div>
									</div>
									<div className="space-y-2">
										<Label id="new-workflow-template-label">
											GitHub Actions YAML
										</Label>
										<YamlWorkflowEditor
											disabled={busy}
											labelledBy="new-workflow-template-label"
											minHeight={EDITOR_HEIGHT}
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
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	)
}
