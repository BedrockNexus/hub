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
import { AdminPageHeader } from './admin-page-header'

type ProjectType = 'addon' | 'skin' | 'map' | 'texture_pack'

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
	projectType: ProjectType
	name: string
	slug: string
	description?: string
	icon?: string
	color?: string
	projectCount: number
	publishedProjectCount: number
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

const PROJECT_TYPES: ProjectType[] = ['addon', 'skin', 'map', 'texture_pack']

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
	addon: 'Add-on',
	skin: 'Skin',
	map: 'Map',
	texture_pack: 'Texture Pack',
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

function draftFromCategory(category: ServerCategory | ProjectCategory) {
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
					<Skeleton className="h-28 rounded-xl" key={key} />
				))}
			</div>
			<div className="grid gap-4 xl:grid-cols-2">
				<Skeleton className="h-96 rounded-xl" />
				<Skeleton className="h-96 rounded-xl" />
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
	kind: 'server' | 'project'
	draft: CategoryDraft
	isPending: boolean
	onOpenChange: (open: boolean) => void
	onChange: (draft: CategoryDraft) => void
	onSubmit: (event: FormEvent<HTMLFormElement>) => void
	open: boolean
	projectType?: ProjectType
	onProjectTypeChange?: (projectType: ProjectType) => void
}) {
	const title =
		kind === 'server' ? 'New Server Category' : 'New Project Category'

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
	kind: 'server' | 'project'
	category: ServerCategory | ProjectCategory
	isPending: boolean
	onEdit: () => void
	onRemove: () => void
}) {
	const usageCount =
		kind === 'server'
			? (category as ServerCategory).serverCount
			: (category as ProjectCategory).projectCount
	const canDeleteCategory = usageCount === 0
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
	kind: 'server' | 'project'
	categories: (ServerCategory | ProjectCategory)[]
	editing: EditingState | null
	pendingAction: string | null
	onEdit: (
		kind: 'server' | 'project',
		category: ServerCategory | ProjectCategory,
	) => void
	onEditChange: (draft: CategoryDraft) => void
	onCancelEdit: () => void
	onSaveEdit: () => void
	onRemove: (
		kind: 'server' | 'project',
		category: ServerCategory | ProjectCategory,
	) => void
}) {
	const emptyLabel =
		kind === 'server'
			? 'No server categories yet.'
			: 'No project categories yet.'

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
					{/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inline row handles admin edit and display states for two category kinds. */}
					{categories.map((category) => {
						const editKey = `${kind}:${category._id}`
						const isEditing =
							editing?.kind === kind &&
							editing.id === category._id
						const isPending =
							pendingAction?.endsWith(`:${category._id}`) ?? false
						const usageCount =
							kind === 'server'
								? (category as ServerCategory).serverCount
								: (category as ProjectCategory).projectCount
						const publishedCount =
							kind === 'server'
								? (category as ServerCategory)
										.publishedServerCount
								: (category as ProjectCategory)
										.publishedProjectCount

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
															(
																category as ProjectCategory
															).projectType
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
}: {
	serverCategories: ServerCategory[]
	projectCategories: ProjectCategory[]
}) {
	const allCategories = [...serverCategories, ...projectCategories]
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
				<StatLabel>Project Types</StatLabel>
				<StatValue>{PROJECT_TYPES.length}</StatValue>
				<StatDescription>Add-ons, skins, maps, packs</StatDescription>
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
		projectCategoriesResult === undefined

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

	const handleEdit = (
		kind: 'server' | 'project',
		category: ServerCategory | ProjectCategory,
	) => {
		setEditing(
			kind === 'server'
				? {
						kind,
						id: category._id as Id<'serverCategories'>,
						draft: draftFromCategory(category),
					}
				: {
						kind,
						id: category._id as Id<'projectCategories'>,
						draft: draftFromCategory(category),
					},
		)
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
			} else {
				await updateProjectCategory({ id: editing.id, ...patch })
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

	const handleRemove = async (
		kind: 'server' | 'project',
		category: ServerCategory | ProjectCategory,
	) => {
		setPendingAction(`remove:${category._id}`)
		try {
			if (kind === 'server') {
				await removeServerCategory({
					id: category._id as Id<'serverCategories'>,
				})
			} else {
				await removeProjectCategory({
					id: category._id as Id<'projectCategories'>,
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
				description="Manage server and project taxonomies from one admin surface."
				title="Categories"
			/>

			<CategoriesStats
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
		</div>
	)
}
