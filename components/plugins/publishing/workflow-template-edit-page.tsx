'use client'

import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	getWorkflowTemplateValidationError,
	YamlWorkflowEditor,
} from '@/components/plugins/editors/yaml-workflow-editor'
import type { WorkflowTemplate } from '@/components/plugins/publishing/workflow-templates-table'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { SettingsSkeleton } from '@/components/user-dashboard/settings-section'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'

const WORKFLOWS_PATH = '/admin/plugins/workflows'

function WorkflowEditForm({
	template,
	software,
}: {
	template: WorkflowTemplate
	software: { _id: Id<'serverSoftware'>; name: string }[]
}) {
	const router = useRouter()
	const saveTemplate = useMutation(
		api.functions.plugins.workflowTemplates.save,
	)
	const removeTemplate = useMutation(
		api.functions.plugins.workflowTemplates.remove,
	)
	const [content, setContent] = useState(template.content)
	const [savedContent, setSavedContent] = useState(template.content)
	const [metadata, setMetadata] = useState({
		label: template.label,
		softwareId: template.softwareId,
	})
	const [savedMetadata, setSavedMetadata] = useState(metadata)
	const [busy, setBusy] = useState(false)
	const changed =
		content !== savedContent ||
		metadata.label !== savedMetadata.label ||
		metadata.softwareId !== savedMetadata.softwareId
	const validName =
		metadata.label.trim().length >= 3 && metadata.label.trim().length <= 80
	const contentError = getWorkflowTemplateValidationError(content)
	useUnsavedChangesWarning(changed && !busy)

	return (
		<form
			className="min-w-0 space-y-5"
			onSubmit={async (event) => {
				event.preventDefault()
				if (busy || !changed || contentError || !validName) {
					return
				}
				setBusy(true)
				try {
					const result = await saveTemplate({
						key: template.key,
						content,
						label: metadata.label,
						softwareId: metadata.softwareId,
					})
					setSavedContent(content)
					const label = metadata.label.trim().replace(/\s+/g, ' ')
					setMetadata((current) => ({ ...current, label }))
					setSavedMetadata({ ...metadata, label })
					toast.success(
						`Workflow template version ${result.version} saved.`,
					)
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: 'The workflow could not be saved.',
					)
				} finally {
					setBusy(false)
				}
			}}
		>
			<div className="flex flex-wrap items-center gap-3">
				<h2 className="font-semibold text-lg">{template.label}</h2>
				<Badge variant="outline">{template.softwareName}</Badge>
				<Badge variant="outline">v{template.version}</Badge>
			</div>
			<div className="grid gap-5 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="workflow-name">Template name</Label>
					<Input
						disabled={busy}
						id="workflow-name"
						maxLength={80}
						minLength={3}
						onChange={(event) =>
							setMetadata((current) => ({
								...current,
								label: event.target.value,
							}))
						}
						required
						value={metadata.label}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="workflow-software">Server software</Label>
					<Select
						disabled={busy}
						items={software.map((item) => ({
							value: item._id,
							label: item.name,
						}))}
						onValueChange={(value) => {
							if (value) {
								setMetadata((current) => ({
									...current,
									softwareId: value as Id<'serverSoftware'>,
								}))
							}
						}}
						value={metadata.softwareId}
					>
						<SelectTrigger
							className="w-full"
							id="workflow-software"
						>
							<SelectValue placeholder="Choose server software" />
						</SelectTrigger>
						<SelectContent>
							{software.map((item) => (
								<SelectItem key={item._id} value={item._id}>
									{item.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="min-w-0 space-y-2">
				<Label id="workflow-template-label">GitHub Actions YAML</Label>
				<YamlWorkflowEditor
					className="min-w-0 max-w-full"
					disabled={busy}
					labelledBy="workflow-template-label"
					minHeight="36rem"
					onChange={setContent}
					value={content}
				/>
			</div>
			<p className="text-muted-foreground text-sm">
				Keep the <code>{'{{package_name}}'}</code> placeholder and
				upload the built plugin as a <code>plugin-package</code>{' '}
				artifact. Workflows cannot run on tags, write to the repository,
				or read secrets.
			</p>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
				<Button
					disabled={busy}
					onClick={async () => {
						if (
							!window.confirm(
								`Delete "${template.label}"? It will no longer be available to publishers.`,
							)
						) {
							return
						}
						setBusy(true)
						try {
							await removeTemplate({ key: template.key })
							toast.success('Workflow deleted.')
							router.push(WORKFLOWS_PATH)
						} catch (error) {
							toast.error(
								error instanceof Error
									? error.message
									: 'The workflow could not be deleted.',
							)
						} finally {
							setBusy(false)
						}
					}}
					type="button"
					variant="destructive"
				>
					<HugeiconsIcon className="size-4" icon={Delete02Icon} />
					Delete workflow
				</Button>
				<Button
					disabled={
						busy || !changed || !validName || contentError !== null
					}
					type="submit"
				>
					{busy ? 'Saving...' : 'Save workflow'}
				</Button>
			</div>
		</form>
	)
}

export function WorkflowTemplateEditPage({
	templateKey,
}: {
	templateKey: string
}) {
	const auth = useConvexAuth()
	const templates = useQuery(
		api.functions.plugins.workflowTemplates.list,
		auth.isAuthenticated ? {} : 'skip',
	)
	const template = templates?.find((item) => item.key === templateKey)
	const software = useQuery(
		api.functions.servers.software.listAdmin,
		auth.isAuthenticated ? {} : 'skip',
	)

	return (
		<div className="min-w-0 space-y-6">
			<Link
				className={buttonVariants({ variant: 'outline' })}
				href={WORKFLOWS_PATH}
			>
				Back to workflow templates
			</Link>
			{auth.isLoading ||
			templates === undefined ||
			software === undefined ? (
				<SettingsSkeleton />
			) : template ? (
				<WorkflowEditForm
					key={template.key}
					software={software}
					template={template}
				/>
			) : (
				<p className="text-muted-foreground">
					Workflow template not found.
				</p>
			)}
		</div>
	)
}
