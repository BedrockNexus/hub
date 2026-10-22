'use client'

import {
	Add01Icon,
	Cancel01Icon,
	Delete02Icon,
	PencilEdit01Icon,
	Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
	PROJECT_TYPES,
	type ProjectType,
	type StoredProjectType,
} from '@/lib/project-artifacts'
import { AdminPageHeader } from './admin-page-header'

interface ServerCategory {
	_id: Id<'serverCategories'>
	name: string
	slug: string
	description?: string
	icon?: string
	color?: string
	serverCount: number
	publishedServerCount: number
}

interface ProjectCategory {
	_id: Id<'projectCategories'>
	projectType: StoredProjectType
	name: string
	slug: string
	description?: string
	icon?: string
	color?: string
	projectCount: number
	publishedProjectCount: number
}

interface PluginCategory {
	_id: Id<'pluginCategories'>
	name: string
	slug: string
	description?: string
	icon?: string
	color?: string
	pluginCount: number
	publishedPluginCount: number
}

type CategoryKind = 'server' | 'project' | 'plugin'
type AnyCategory = ServerCategory | ProjectCategory | PluginCategory

const KIND_LABELS: Record<CategoryKind, string> = {
	server: 'Server',
	project: 'Project',
	plugin: 'Plugin',
}

/** How many listings use a category, and how many of those are published. */
function categoryUsage(kind: CategoryKind, category: AnyCategory) {
	if (kind === 'server') {
		const server = category as ServerCategory
		return {
			total: server.serverCount,
			published: server.publishedServerCount,
		}
	}
	if (kind === 'project') {
		const project = category as ProjectCategory
		return {
			total: project.projectCount,
			published: project.publishedProjectCount,
		}
	}
	const plugin = category as PluginCategory
	return { total: plugin.pluginCount, published: plugin.publishedPluginCount }
}

interface CategoryDraft {
	name: string
	description: string
	icon: string
	color: string
}

type EditingState =
	| {
			kind: 'server'
			id: Id<'serverCategories'>
			draft: CategoryDraft
	  }
	| {
			kind: 'project'
			id: Id<'projectCategories'>
			draft: CategoryDraft
	  }
	| {
			kind: 'plugin'
			id: Id<'pluginCategories'>
			draft: CategoryDraft
	  }

const EMPTY_DRAFT: CategoryDraft = {
	name: '',
	description: '',
	icon: '',
	color: '',
}
const CATEGORY_SKELETON_KEYS = [
	'server-categories',
	'project-categories',
	'used-categories',
	'project-types',
]

function optionalString(value: string) {
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}

function formatNumber(value: number) {
	return new Intl.NumberFormat('en-US').format(value)
}

function draftFromCategory(category: AnyCategory) {
	return {
		name: category.name,
		description: category.description ?? '',
		icon: category.icon ?? '',
		color: category.color ?? '',
	}
}

function ColorSwatch({ color }: { color?: string }) {
	if (!color) {
		return <span className="text-muted-foreground">None</span>
	}

	return (
		<span className="inline-flex items-center gap-2">
			<span
				aria-hidden="true"
				className="size-4 rounded border border-border"
				style={{ backgroundColor: color }}
			/>
			<span className="font-mono text-xs">{color}</span>
		</span>
	)
}

function AdminCategoriesSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{CATEGORY_SKELETON_KEYS.map((key) => (
					<Skeleton className="h-28 rounded-md" key={key} />
				))}
			</div>
			<div className="grid gap-4 xl:grid-cols-2">
				<Skeleton className="h-96 rounded-md" />
				<Skeleton className="h-96 rounded-md" />
			</div>
		</div>
	)
}

function DraftFields({
	draft,
	idPrefix,
	isDisabled,
	onChange,
}: {
	draft: CategoryDraft
	idPrefix: string
	isDisabled?: boolean
	onChange: (draft: CategoryDraft) => void
}) {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-name`}>Name</Label>
				<Input
					disabled={isDisabled}
					id={`${idPrefix}-name`}
					onChange={(event) =>
						onChange({ ...draft, name: event.target.value })
					}
					placeholder="Survival"
					value={draft.name}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-icon`}>Icon</Label>
				<Input
					disabled={isDisabled}
					id={`${idPrefix}-icon`}
					onChange={(event) =>
						onChange({ ...draft, icon: event.target.value })
					}
					placeholder="cube"
					value={draft.icon}
				/>
			</div>
			<div className="space-y-2 md:col-span-2">
				<Label htmlFor={`${idPrefix}-description`}>Description</Label>
				<Textarea
					disabled={isDisabled}
					id={`${idPrefix}-description`}
					onChange={(event) =>
						onChange({ ...draft, description: event.target.value })
					}
					placeholder="Short category description"
					value={draft.description}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${idPrefix}-color`}>Color</Label>
				<div className="flex gap-2">
					<Input
						disabled={isDisabled}
						id={`${idPrefix}-color`}
						onChange={(event) =>
							onChange({ ...draft, color: event.target.value })
						}
						placeholder="#22c55e"
						value={draft.color}
					/>
					{draft.color ? (
						<span
							aria-hidden="true"
							className="size-9 shrink-0 rounded-md border border-border"
							style={{ backgroundColor: draft.color }}
						/>
					) : null}
				</div>
			</div>
		</div>
	)
}

function CategoryCreateDialog({
	kind,
	draft,
	isPending,
	onOpenChange,
	onChange,
	onSubmit,
	open,
	projectType,
	onProjectTypeChange,
}: {
	kind: CategoryKind
	draft: CategoryDraft
	isPending: boolean
	onOpenChange: (open: boolean) => void
	onChange: (draft: CategoryDraft) => void
	onSubmit: (event: FormEvent<HTMLFormElement>) => void
	open: boolean
	projectType?: ProjectType
	onProjectTypeChange?: (projectType: ProjectType) => void
}) {
	const title = `New ${KIND_LABELS[kind]} Category`

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogTrigger render={<Button />}>
				<HugeiconsIcon className="size-4" icon={Add01Icon} />
				{title}
			</DialogTrigger>
			<DialogContent
				className="sm:max-w-2xl"
				showCloseButton={!isPending}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Create taxonomy entries for discovery and filtering.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-5" onSubmit={onSubmit}>
					{kind === 'project' &&
					projectType &&
					onProjectTypeChange ? (
						<div className="space-y-2">
							<Label htmlFor="project-category-type">
								Project Type
							</Label>
							<Select
								onValueChange={(value) =>
									onProjectTypeChange(value as ProjectType)
								}
								value={projectType}
							>
								<SelectTrigger
									className="w-full"
									id="project-category-type"
								>
									<SelectValue>
										{PROJECT_TYPE_LABELS[projectType]}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{PROJECT_TYPES.map((type) => (
										<SelectItem key={type} value={type}>
											{PROJECT_TYPE_LABELS[type]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}
					<DraftFields
						draft={draft}
						idPrefix={`create-${kind}`}
						isDisabled={isPending}
						onChange={onChange}
					/>
					<DialogFooter>
						<Button
							disabled={isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={isPending || !draft.name.trim()}
							type="submit"
						>
							<HugeiconsIcon
								className="size-4"
								icon={Add01Icon}
							/>
							{isPending ? 'Creating...' : 'Create Category'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

function CategoryActions({
	kind,
	category,
	isPending,
	onEdit,
	onRemove,
}: {
	kind: CategoryKind
	category: AnyCategory
	isPending: boolean
	onEdit: () => void
	onRemove: () => void
}) {
	const canDeleteCategory = categoryUsage(kind, category).total === 0
	return (
		<div className="flex justify-end gap-2">
			<Button
				aria-label={`Edit ${category.name}`}
				disabled={isPending}
				onClick={onEdit}
				size="icon"
				variant="outline"
			>
				<HugeiconsIcon className="size-4" icon={PencilEdit01Icon} />
			</Button>
			<AlertDialog>
				<AlertDialogTrigger
					disabled={isPending || !canDeleteCategory}
					render={
						<Button
							disabled={isPending || !canDeleteCategory}
							variant="outline"
						/>
					}
				>
					<HugeiconsIcon className="size-4" icon={Delete02Icon} />
					Delete
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {category.name}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Unused categories are permanently removed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={onRemove}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

function CategoryTable({
	kind,
	categories,
	editing,
	pendingAction,
	onEdit,
	onEditChange,
	onCancelEdit,
	onSaveEdit,
	onRemove,
}: {
	kind: CategoryKind
	categories: AnyCategory[]
	editing: EditingState | null
	pendingAction: string | null
	onEdit: (kind: CategoryKind, category: AnyCategory) => void
	onEditChange: (draft: CategoryDraft) => void
	onCancelEdit: () => void
	onSaveEdit: () => void
	onRemove: (kind: CategoryKind, category: AnyCategory) => void
}) {
	const emptyLabel = `No ${KIND_LABELS[kind].toLowerCase()} categories yet.`

	return (
		<div className="overflow-hidden rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Category</TableHead>
						{kind === 'project' ? (
							<TableHead>Type</TableHead>
						) : null}
						<TableHead>Usage</TableHead>
						<TableHead>Color</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{categories.length === 0 ? (
						<TableRow>
							<TableCell
								className="h-24 text-center text-muted-foreground"
								colSpan={kind === 'project' ? 5 : 4}
							>
								{emptyLabel}
							</TableCell>
						</TableRow>
					) : null}
					{categories.map((category) => {
						const editKey = `${kind}:${category._id}`
						const isEditing =
							editing?.kind === kind &&
							editing.id === category._id
						const isPending =
							pendingAction?.endsWith(`:${category._id}`) ?? false
						const { total: usageCount, published: publishedCount } =
							categoryUsage(kind, category)

						return (
							<TableRow key={editKey}>
								{isEditing ? (
									<TableCell
										className="whitespace-normal"
										colSpan={kind === 'project' ? 5 : 4}
									>
										<div className="space-y-4 py-2">
											<DraftFields
												draft={editing.draft}
												idPrefix={`edit-${editKey}`}
												isDisabled={isPending}
												onChange={onEditChange}
											/>
											<div className="flex flex-wrap justify-end gap-2">
												<Button
													disabled={isPending}
													onClick={onCancelEdit}
													variant="outline"
												>
													<HugeiconsIcon
														className="size-4"
														icon={Cancel01Icon}
													/>
													Cancel
												</Button>
												<Button
													disabled={
														isPending ||
														!editing.draft.name.trim()
													}
													onClick={onSaveEdit}
												>
													<HugeiconsIcon
														className="size-4"
														icon={Tick02Icon}
													/>
													{isPending
														? 'Saving...'
														: 'Save Category'}
												</Button>
											</div>
										</div>
									</TableCell>
								) : (
									<>
										<TableCell className="min-w-64 whitespace-normal">
											<div className="flex items-start gap-3">
												<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-sm">
													{category.icon ||
														category.name.charAt(0)}
												</div>
												<div className="min-w-0 space-y-1">
													<div className="font-medium">
														{category.name}
													</div>
													<div className="text-muted-foreground text-xs">
														/{category.slug}
													</div>
													{category.description ? (
														<div className="line-clamp-2 text-muted-foreground text-xs">
															{
																category.description
															}
														</div>
													) : null}
												</div>
											</div>
										</TableCell>
										{kind === 'project' ? (
											<TableCell>
												<Badge variant="secondary">
													{
														PROJECT_TYPE_LABELS[
															normalizeProjectType(
																(
																	category as ProjectCategory
																).projectType,
															)
														]
													}
												</Badge>
											</TableCell>
										) : null}
										<TableCell>
											<div className="font-medium">
												{formatNumber(usageCount)} total
											</div>
											<div className="text-muted-foreground text-xs">
												{formatNumber(publishedCount)}{' '}
												published
											</div>
										</TableCell>
										<TableCell>
											<ColorSwatch
												color={category.color}
											/>
										</TableCell>
										<TableCell>
											<CategoryActions
												category={category}
												isPending={isPending}
												kind={kind}
												onEdit={() =>
													onEdit(kind, category)
												}
												onRemove={() =>
													onRemove(kind, category)
												}
											/>
										</TableCell>
									</>
								)}
							</TableRow>
						)
					})}
				</TableBody>
			</Table>
		</div>
	)
}

function CategoriesStats({
	serverCategories,
	projectCategories,
	pluginCategories,
}: {
	serverCategories: ServerCategory[]
	projectCategories: ProjectCategory[]
	pluginCategories: PluginCategory[]
}) {
	const allCategories = [
		...serverCategories,
		...projectCategories,
		...pluginCategories,
	]
	const pluginUsage = pluginCategories.reduce(
		(sum, category) => sum + category.pluginCount,
		0,
	)
	const serverUsage = serverCategories.reduce(
		(sum, category) => sum + category.serverCount,
		0,
	)
	const projectUsage = projectCategories.reduce(
		(sum, category) => sum + category.projectCount,
		0,
	)

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Stat>
				<StatLabel>Total Categories</StatLabel>
				<StatValue>{formatNumber(allCategories.length)}</StatValue>
				<StatDescription>Sorted alphabetically by name</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Server Categories</StatLabel>
				<StatValue>{formatNumber(serverCategories.length)}</StatValue>
				<StatDescription>
					{formatNumber(serverUsage)} total server assignments
				</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Project Categories</StatLabel>
				<StatValue>{formatNumber(projectCategories.length)}</StatValue>
				<StatDescription>
					{formatNumber(projectUsage)} total project assignments
				</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Plugin Categories</StatLabel>
				<StatValue>{formatNumber(pluginCategories.length)}</StatValue>
				<StatDescription>
					{formatNumber(pluginUsage)} total plugin assignments
				</StatDescription>
			</Stat>
		</div>
	)
}

export function AdminCategoriesManager() {
	const serverCategoriesResult = useQuery(
		api.functions.servers.categories.listAdmin,
		{},
	)
	const projectCategoriesResult = useQuery(
		api.functions.projects.categories.listAdmin,
		{},
	)
	const createServerCategory = useMutation(
		api.functions.servers.categories.create,
	)
	const updateServerCategory = useMutation(
		api.functions.servers.categories.update,
	)
	const removeServerCategory = useMutation(
		api.functions.servers.categories.remove,
	)
	const createProjectCategory = useMutation(
		api.functions.projects.categories.create,
	)
	const updateProjectCategory = useMutation(
		api.functions.projects.categories.update,
	)
	const removeProjectCategory = useMutation(
		api.functions.projects.categories.remove,
	)
	const pluginCategoriesResult = useQuery(
		api.functions.plugins.categories.listAdmin,
		{},
	)
	const createPluginCategory = useMutation(
		api.functions.plugins.categories.create,
	)
	const updatePluginCategory = useMutation(
		api.functions.plugins.categories.update,
	)
	const removePluginCategory = useMutation(
		api.functions.plugins.categories.remove,
	)
	const [pluginDraft, setPluginDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
	const [isPluginCreateOpen, setIsPluginCreateOpen] = useState(false)
	const pluginCategories = useMemo(
		() =>
			[...(pluginCategoriesResult ?? [])].sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		[pluginCategoriesResult],
	)

	const [serverDraft, setServerDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
	const [projectDraft, setProjectDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
	const [isServerCreateOpen, setIsServerCreateOpen] = useState(false)
	const [isProjectCreateOpen, setIsProjectCreateOpen] = useState(false)
	const [projectType, setProjectType] = useState<ProjectType>('addon')
	const [editing, setEditing] = useState<EditingState | null>(null)
	const [pendingAction, setPendingAction] = useState<string | null>(null)

	const serverCategories = useMemo(
		() =>
			[...(serverCategoriesResult ?? [])].sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		[serverCategoriesResult],
	)
	const projectCategories = useMemo(
		() =>
			[...(projectCategoriesResult ?? [])].sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		[projectCategoriesResult],
	)

	const isLoading =
		serverCategoriesResult === undefined ||
		projectCategoriesResult === undefined ||
		pluginCategoriesResult === undefined

	const handleServerCreateOpenChange = (open: boolean) => {
		if (pendingAction === 'create:server') {
			return
		}

		setIsServerCreateOpen(open)
		if (!open) {
			setServerDraft(EMPTY_DRAFT)
		}
	}

	const handleProjectCreateOpenChange = (open: boolean) => {
		if (pendingAction === 'create:project') {
			return
		}

		setIsProjectCreateOpen(open)
		if (!open) {
			setProjectDraft(EMPTY_DRAFT)
			setProjectType('addon')
		}
	}

	const handleCreateServer = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const name = serverDraft.name.trim()
		if (!name) {
			return
		}

		setPendingAction('create:server')
		try {
			await createServerCategory({
				name,
				description: optionalString(serverDraft.description),
				icon: optionalString(serverDraft.icon),
				color: optionalString(serverDraft.color),
			})
			setServerDraft(EMPTY_DRAFT)
			setIsServerCreateOpen(false)
			toast.success(`Created ${name}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not create category',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const name = projectDraft.name.trim()
		if (!name) {
			return
		}

		setPendingAction('create:project')
		try {
			await createProjectCategory({
				projectType,
				name,
				description: optionalString(projectDraft.description),
				icon: optionalString(projectDraft.icon),
				color: optionalString(projectDraft.color),
			})
			setProjectDraft(EMPTY_DRAFT)
			setProjectType('addon')
			setIsProjectCreateOpen(false)
			toast.success(`Created ${name}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not create category',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handlePluginCreateOpenChange = (open: boolean) => {
		if (pendingAction === 'create:plugin') {
			return
		}

		setIsPluginCreateOpen(open)
		if (!open) {
			setPluginDraft(EMPTY_DRAFT)
		}
	}

	const handleCreatePlugin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const name = pluginDraft.name.trim()
		if (!name) {
			return
		}

		setPendingAction('create:plugin')
		try {
			await createPluginCategory({
				name,
				description: optionalString(pluginDraft.description),
				icon: optionalString(pluginDraft.icon),
				color: optionalString(pluginDraft.color),
			})
			setPluginDraft(EMPTY_DRAFT)
			setIsPluginCreateOpen(false)
			toast.success(`Created ${name}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not create category',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handleEdit = (kind: CategoryKind, category: AnyCategory) => {
		const draft = draftFromCategory(category)
		if (kind === 'server') {
			setEditing({
				kind,
				id: category._id as Id<'serverCategories'>,
				draft,
			})
		} else if (kind === 'project') {
			setEditing({
				kind,
				id: category._id as Id<'projectCategories'>,
				draft,
			})
		} else {
			setEditing({
				kind,
				id: category._id as Id<'pluginCategories'>,
				draft,
			})
		}
	}

	const handleSaveEdit = async () => {
		if (!editing) {
			return
		}

		const name = editing.draft.name.trim()
		if (!name) {
			return
		}

		setPendingAction(`save:${editing.id}`)
		try {
			const patch = {
				name,
				description: optionalString(editing.draft.description),
				icon: optionalString(editing.draft.icon),
				color: optionalString(editing.draft.color),
			}

			if (editing.kind === 'server') {
				await updateServerCategory({ id: editing.id, ...patch })
			} else if (editing.kind === 'project') {
				await updateProjectCategory({ id: editing.id, ...patch })
			} else {
				await updatePluginCategory({ id: editing.id, ...patch })
			}

			setEditing(null)
			toast.success(`Saved ${name}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not save category',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handleRemove = async (kind: CategoryKind, category: AnyCategory) => {
		setPendingAction(`remove:${category._id}`)
		try {
			if (kind === 'server') {
				await removeServerCategory({
					id: category._id as Id<'serverCategories'>,
				})
			} else if (kind === 'project') {
				await removeProjectCategory({
					id: category._id as Id<'projectCategories'>,
				})
			} else {
				await removePluginCategory({
					id: category._id as Id<'pluginCategories'>,
				})
			}
			toast.success(`Deleted ${category.name}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not remove category',
			)
		} finally {
			setPendingAction(null)
		}
	}

	if (isLoading) {
		return <AdminCategoriesSkeleton />
	}

	return (
		<div className="min-w-0 space-y-6">
			<AdminPageHeader
				description="Manage server, project and plugin categories in one place."
				title="Categories"
			/>

			<CategoriesStats
				pluginCategories={pluginCategories}
				projectCategories={projectCategories}
				serverCategories={serverCategories}
			/>

			<Card>
				<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1.5">
						<CardTitle>Server Categories</CardTitle>
						<CardDescription>
							Server categories can be deleted only when they are
							unused.
						</CardDescription>
					</div>
					<CategoryCreateDialog
						draft={serverDraft}
						isPending={pendingAction === 'create:server'}
						kind="server"
						onChange={setServerDraft}
						onOpenChange={handleServerCreateOpenChange}
						onSubmit={handleCreateServer}
						open={isServerCreateOpen}
					/>
				</CardHeader>
				<CardContent>
					<CategoryTable
						categories={serverCategories}
						editing={editing}
						kind="server"
						onCancelEdit={() => setEditing(null)}
						onEdit={handleEdit}
						onEditChange={(draft) =>
							setEditing((current) =>
								current ? { ...current, draft } : current,
							)
						}
						onRemove={handleRemove}
						onSaveEdit={() => {
							handleSaveEdit()
						}}
						pendingAction={pendingAction}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1.5">
						<CardTitle>Project Categories</CardTitle>
						<CardDescription>
							Project categories can be deleted only when they are
							unused.
						</CardDescription>
					</div>
					<CategoryCreateDialog
						draft={projectDraft}
						isPending={pendingAction === 'create:project'}
						kind="project"
						onChange={setProjectDraft}
						onOpenChange={handleProjectCreateOpenChange}
						onProjectTypeChange={setProjectType}
						onSubmit={handleCreateProject}
						open={isProjectCreateOpen}
						projectType={projectType}
					/>
				</CardHeader>
				<CardContent>
					<CategoryTable
						categories={projectCategories}
						editing={editing}
						kind="project"
						onCancelEdit={() => setEditing(null)}
						onEdit={handleEdit}
						onEditChange={(draft) =>
							setEditing((current) =>
								current ? { ...current, draft } : current,
							)
						}
						onRemove={handleRemove}
						onSaveEdit={() => {
							handleSaveEdit()
						}}
						pendingAction={pendingAction}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1.5">
						<CardTitle>Plugin Categories</CardTitle>
						<CardDescription>
							Plugin categories can be deleted only when they are
							unused.
						</CardDescription>
					</div>
					<CategoryCreateDialog
						draft={pluginDraft}
						isPending={pendingAction === 'create:plugin'}
						kind="plugin"
						onChange={setPluginDraft}
						onOpenChange={handlePluginCreateOpenChange}
						onSubmit={handleCreatePlugin}
						open={isPluginCreateOpen}
					/>
				</CardHeader>
				<CardContent>
					<CategoryTable
						categories={pluginCategories}
						editing={editing}
						kind="plugin"
						onCancelEdit={() => setEditing(null)}
						onEdit={handleEdit}
						onEditChange={(draft) =>
							setEditing((current) =>
								current ? { ...current, draft } : current,
							)
						}
						onRemove={handleRemove}
						onSaveEdit={() => {
							handleSaveEdit()
						}}
						pendingAction={pendingAction}
					/>
				</CardContent>
			</Card>
		</div>
	)
}
