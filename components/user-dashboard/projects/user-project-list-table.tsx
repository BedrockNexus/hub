'use client'

import {
	Copy01Icon,
	Delete02Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	PuzzleIcon,
	StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type {
	Column,
	ColumnDef,
	ColumnFiltersState,
} from '@tanstack/react-table'
import {
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
import { Status, StatusLabel } from '@/components/dice-ui/status'
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { DashboardEmptyState } from '@/components/user-dashboard/dashboard-empty-state'
import { DashboardTableSkeleton } from '@/components/user-dashboard/dashboard-table-skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

interface ProjectCategory {
	_id: Id<'projectCategories'>
	name: string
	slug: string
}

type ProjectLifecycleStatus = 'draft' | 'published' | 'under_review'

type ProjectType = 'addon' | 'skin' | 'map' | 'texture_pack'

interface ProjectRow {
	_id: Id<'projects'>
	name: string
	slug: string
	type: ProjectType
	status?: ProjectLifecycleStatus
	categories: (ProjectCategory | null)[]
	iconUrl?: string
	bannerUrl?: string
	_creationTime: number
	updatedAt?: number
	totalDownloads: number
	averageRating: number
	reviewCount: number
	latestVersionString?: string
}

const TYPE_LABELS: Record<ProjectType, string> = {
	addon: 'Addon',
	skin: 'Skin',
	map: 'Map',
	texture_pack: 'Texture Pack',
}

const STATUS_VARIANTS: Record<
	ProjectLifecycleStatus,
	'success' | 'warning' | 'error' | 'default'
> = {
	published: 'success',
	under_review: 'warning',
	draft: 'default',
}

const STATUS_LABELS: Record<ProjectLifecycleStatus, string> = {
	published: 'Published',
	under_review: 'Under Review',
	draft: 'Draft',
}

function ProjectRowActionsCell({
	content,
	onDelete,
}: {
	content: ProjectRow
	onDelete: () => Promise<void>
}) {
	const [isDeleting, setIsDeleting] = useState(false)

	const handleDelete = async () => {
		setIsDeleting(true)
		try {
			await onDelete()
		} finally {
			setIsDeleting(false)
		}
	}

	const handleCopyId = async () => {
		try {
			await navigator.clipboard.writeText(content._id)
			toast.success('Project ID copied')
		} catch {
			toast.error('Failed to copy project ID')
		}
	}

	return (
		<AlertDialog>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={(props) => (
						<Button {...props} size="icon" variant="ghost">
							<HugeiconsIcon
								className="size-4"
								icon={MoreHorizontalIcon}
							/>
							<span className="sr-only">Open menu</span>
						</Button>
					)}
				/>
				<DropdownMenuContent align="end" className="w-full">
					<DropdownMenuItem onClick={handleCopyId}>
						<HugeiconsIcon className="size-4" icon={Copy01Icon} />
						Copy Project ID
					</DropdownMenuItem>
					<DropdownMenuItem
						nativeButton={false}
						render={(props) => (
							<Link
								{...props}
								href={`/dashboard/projects/${content.slug}/edit`}
							>
								<HugeiconsIcon
									className="size-4"
									icon={PencilEdit01Icon}
								/>
								Edit
							</Link>
						)}
					/>
					<DropdownMenuItem
						nativeButton={false}
						render={(props) => (
							<Link {...props} href={`/projects/${content.slug}`}>
								<HugeiconsIcon
									className="size-4"
									icon={PuzzleIcon}
								/>
								View Public Page
							</Link>
						)}
					/>
					<AlertDialogTrigger
						nativeButton={false}
						render={(props) => (
							<DropdownMenuItem
								{...props}
								onSelect={(e) => e.preventDefault()}
								variant="destructive"
							>
								<HugeiconsIcon
									className="size-4"
									icon={Delete02Icon}
								/>
								Delete
							</DropdownMenuItem>
						)}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you sure?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete{' '}
						<strong>{content.name}</strong>. This action cannot be
						undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						disabled={isDeleting}
						onClick={handleDelete}
					>
						{isDeleting ? (
							<>
								<Spinner className="mr-2 size-4" />
								Deleting...
							</>
						) : (
							'Delete'
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function ProjectStatusBadge({ status }: { status?: ProjectLifecycleStatus }) {
	if (!status) {
		return (
			<Status variant="default">
				<StatusLabel>Unknown</StatusLabel>
			</Status>
		)
	}

	return (
		<Status variant={STATUS_VARIANTS[status]}>
			<StatusLabel>{STATUS_LABELS[status]}</StatusLabel>
		</Status>
	)
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────

function ProjectStatsBar({ items }: { items: ProjectRow[] }) {
	const totalItems = items.length
	const publishedItems = items.filter((i) => i.status === 'published').length
	const totalDownloads = items.reduce((sum, a) => sum + a.totalDownloads, 0)
	const ratedItems = items.filter((i) => i.reviewCount > 0)
	const avgRating =
		ratedItems.length > 0
			? ratedItems.reduce((sum, a) => sum + a.averageRating, 0) /
				ratedItems.length
			: 0

	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<Stat>
				<StatLabel>Total Projects</StatLabel>
				<StatValue>{totalItems}</StatValue>
				<StatDescription>
					{publishedItems} published . {totalItems - publishedItems}{' '}
					unpublished
				</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Total Downloads</StatLabel>
				<StatValue>{totalDownloads.toLocaleString()}</StatValue>
				<StatDescription>across all projects</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Average Rating</StatLabel>
				<StatValue>
					{avgRating > 0 ? avgRating.toFixed(1) : '-'}
				</StatValue>
				<StatDescription>
					{ratedItems.length > 0
						? `${ratedItems.length} rated`
						: 'No ratings yet'}
				</StatDescription>
			</Stat>
		</div>
	)
}

interface ProjectListTableProps {
	createHref?: string
	createLabel?: string
	emptyDescription?: string
	emptyTitle?: string
	organizationId?: string
}

export function ProjectListTable({
	createHref = '/dashboard/projects/add',
	createLabel = 'Create Your First Project',
	emptyDescription = 'Create your first project to share with the Bedrock community.',
	emptyTitle = 'No projects yet',
	organizationId,
}: ProjectListTableProps = {}) {
	const personalContent = useQuery(
		api.functions.projects.projects.listMyContent,
		organizationId ? 'skip' : {},
	)
	const organizationContent = useQuery(
		api.functions.projects.projects.listByOrganization,
		organizationId ? { organizationId } : 'skip',
	)
	const categories = useQuery(api.functions.projects.categories.list, {})
	const deleteContent = useMutation(api.functions.projects.projects.remove)

	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const projects = organizationId ? organizationContent : personalContent

	const contentItems: ProjectRow[] = useMemo(() => {
		if (!projects) {
			return []
		}
		return projects.map((c) => ({
			...c,
			categories: c.categories,
		}))
	}, [projects])

	const availableCategories = useMemo(() => {
		if (!categories) {
			return []
		}
		return categories.map((cat) => ({
			label: cat.name,
			value: cat.slug,
		}))
	}, [categories])

	const handleDelete = useCallback(
		async (contentId: Id<'projects'>, contentName: string) => {
			try {
				await deleteContent({ id: contentId })
				toast.success(`${contentName} has been deleted`)
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: 'Failed to delete project',
				)
			}
		},
		[deleteContent],
	)

	const columns = useMemo<ColumnDef<ProjectRow>[]>(
		() => [
			{
				id: 'icon',
				header: 'Icon',
				cell: ({ row }) =>
					row.original.iconUrl ? (
						<Image
							alt={`${row.original.name} icon`}
							className="rounded object-cover"
							height={32}
							src={row.original.iconUrl}
							width={32}
						/>
					) : (
						<div className="flex size-8 items-center justify-center rounded bg-muted font-medium text-xs">
							{row.original.name.charAt(0).toUpperCase()}
						</div>
					),
				size: 48,
				enableSorting: false,
			},
			{
				id: 'name',
				accessorKey: 'name',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Name" />,
				cell: ({ row }) => (
					<Link
						className="font-medium hover:underline"
						href={`/dashboard/projects/${row.original.slug}/edit`}
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: 'Name',
					placeholder: 'Search projects...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'status',
				accessorKey: 'status',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Status" />,
				cell: ({ row }) => (
					<ProjectStatusBadge status={row.original.status} />
				),
				meta: {
					label: 'Status',
					variant: 'multiSelect',
					options: [
						{ label: 'Published', value: 'published' },
						{ label: 'Draft', value: 'draft' },
						{ label: 'Under Review', value: 'under_review' },
					],
				},
				enableColumnFilter: true,
			},
			{
				id: 'type',
				accessorKey: 'type',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Type" />,
				cell: ({ row }) => (
					<Badge className="text-xs" variant="secondary">
						{TYPE_LABELS[row.original.type] ?? row.original.type}
					</Badge>
				),
				meta: {
					label: 'Type',
					variant: 'multiSelect',
					options: Object.entries(TYPE_LABELS).map(
						([value, label]) => ({ label, value }),
					),
				},
				enableColumnFilter: true,
			},
			{
				id: 'downloads',
				accessorKey: 'totalDownloads',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="Downloads" />
				),
				cell: ({ row }) => (
					<div className="font-mono text-muted-foreground text-sm">
						{row.original.totalDownloads.toLocaleString()}
					</div>
				),
				meta: {
					label: 'Downloads',
				},
			},
			{
				id: 'rating',
				accessorKey: 'averageRating',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Rating" />,
				cell: ({ row }) => {
					const rating = row.original.averageRating
					if (rating === 0) {
						return (
							<span className="text-muted-foreground text-sm">
								-
							</span>
						)
					}
					return (
						<div className="flex items-center gap-1 text-sm">
							<HugeiconsIcon
								className="size-3.5 text-yellow-500"
								icon={StarIcon}
							/>
							<span className="font-mono">
								{rating.toFixed(1)}
							</span>
							<span className="text-muted-foreground">
								({row.original.reviewCount})
							</span>
						</div>
					)
				},
				meta: {
					label: 'Rating',
				},
			},
			{
				id: 'version',
				accessorKey: 'latestVersionString',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Version" />,
				cell: ({ row }) => {
					const v = row.original.latestVersionString
					if (!v) {
						return (
							<span className="text-muted-foreground text-sm">
								-
							</span>
						)
					}
					return (
						<Badge className="font-mono text-xs" variant="outline">
							v{v}
						</Badge>
					)
				},
				meta: {
					label: 'Latest Version',
				},
			},
			{
				id: 'categories',
				accessorKey: 'categories',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="Categories" />
				),
				cell: ({ row }) => {
					const cats = (row.original.categories || []).filter(
						Boolean,
					) as ProjectCategory[]
					return (
						<div className="flex flex-wrap gap-1">
							{cats.slice(0, 2).map((cat) => (
								<Badge
									className="text-xs"
									key={cat._id}
									variant="outline"
								>
									{cat.name}
								</Badge>
							))}
							{cats.length > 2 && (
								<Badge className="text-xs" variant="outline">
									+{cats.length - 2}
								</Badge>
							)}
						</div>
					)
				},
				filterFn: (row, _id, filterValue) => {
					if (!filterValue || filterValue.length === 0) {
						return true
					}
					const cats = (row.original.categories || []).filter(
						Boolean,
					) as ProjectCategory[]
					const slugs = cats.map((c) => c.slug)
					return filterValue.some((s: string) => slugs.includes(s))
				},
				meta: {
					label: 'Categories',
					variant: 'multiSelect',
					options: availableCategories,
				},
				enableColumnFilter: true,
			},
			{
				id: 'createdAt',
				accessorKey: '_creationTime',
				header: ({
					column,
				}: {
					column: Column<ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Created" />,
				cell: ({ row }) => (
					<div className="text-muted-foreground text-sm">
						{new Date(
							row.original._creationTime,
						).toLocaleDateString()}
					</div>
				),
				meta: {
					label: 'Created Date',
				},
			},
			{
				id: 'actions',
				cell: ({ row }) => {
					const contentItem = row.original
					return (
						<ProjectRowActionsCell
							content={contentItem}
							onDelete={() =>
								handleDelete(contentItem._id, contentItem.name)
							}
						/>
					)
				},
				size: 32,
			},
		],
		[availableCategories, handleDelete],
	)

	const table = useReactTable({
		data: contentItems,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		onColumnFiltersChange: setColumnFilters,
		state: {
			columnFilters,
		},
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	})

	// Loading state
	if (projects === undefined) {
		return <DashboardTableSkeleton />
	}

	// Empty state
	if (contentItems.length === 0) {
		return (
			<DashboardEmptyState
				createHref={createHref}
				createLabel={createLabel}
				description={emptyDescription}
				icon={PuzzleIcon}
				title={emptyTitle}
			/>
		)
	}

	return (
		<div className="space-y-6">
			{/* Stats Bar */}
			<ProjectStatsBar items={contentItems} />

			<DataTable table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
