'use client'

import {
	Copy01Icon,
	MoreHorizontalIcon,
	PuzzleIcon,
	ViewIcon,
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
import { useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
	type LifecycleStatus,
	LifecycleStatusBadge,
	type ModerationStatus,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { AdminPageHeader } from '@/components/admin-dashboard/admin-page-header'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DashboardTableSkeleton } from '@/components/user-dashboard/dashboard-table-skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
	type StoredProjectType,
} from '@/lib/project-artifacts'

interface AdminProjectCategory {
	_id: Id<'projectCategories'>
	name: string
	slug: string
}

interface AdminProjectRow {
	_id: Id<'projects'>
	_creationTime: number
	type: StoredProjectType
	name: string
	slug: string
	status?: LifecycleStatus
	moderationStatus?: ModerationStatus
	ownerType: 'user' | 'organization'
	ownerName: string
	createdByName: string
	categories: AdminProjectCategory[]
	iconUrl?: string
	averageRating: number
	reviewCount: number
	totalDownloads: number
	latestVersionString?: string
	updatedAt: number
}

function AdminProjectStats({ projects }: { projects: AdminProjectRow[] }) {
	const publishedCount = projects.filter(
		(project) => project.status === 'published',
	).length
	const reviewCount = projects.filter(
		(project) => project.status === 'under_review',
	).length
	const totalDownloads = projects.reduce(
		(sum, project) => sum + project.totalDownloads,
		0,
	)

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Stat>
				<StatLabel>Total Projects</StatLabel>
				<StatValue>{projects.length}</StatValue>
				<StatDescription>{publishedCount} published</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Under Review</StatLabel>
				<StatValue>{reviewCount}</StatValue>
				<StatDescription>Awaiting publishing decision</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Published</StatLabel>
				<StatValue>{publishedCount}</StatValue>
				<StatDescription>Visible on public listings</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Downloads</StatLabel>
				<StatValue>{totalDownloads.toLocaleString()}</StatValue>
				<StatDescription>Across listed projects</StatDescription>
			</Stat>
		</div>
	)
}

function ProjectActionsCell({ project }: { project: AdminProjectRow }) {
	const copyId = async () => {
		try {
			await navigator.clipboard.writeText(project._id)
			toast.success('Project ID copied')
		} catch {
			toast.error('Failed to copy project ID')
		}
	}

	return (
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
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuItem
					nativeButton={false}
					render={(props) => (
						<Link
							{...props}
							href={`/admin/projects/${project._id}`}
						/>
					)}
				>
					<HugeiconsIcon className="size-4" icon={ViewIcon} />
					Review Submission
				</DropdownMenuItem>
				<DropdownMenuItem onClick={copyId}>
					<HugeiconsIcon className="size-4" icon={Copy01Icon} />
					Copy Project ID
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function AdminProjectsTable() {
	const adminProjects = useQuery(api.functions.projects.projects.listAdmin, {
		limit: 250,
	})
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

	const projects = useMemo(
		() => (adminProjects ?? []) as AdminProjectRow[],
		[adminProjects],
	)

	const columns = useMemo<ColumnDef<AdminProjectRow>[]>(
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
				enableSorting: false,
				size: 48,
			},
			{
				id: 'name',
				accessorKey: 'name',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Project" />,
				cell: ({ row }) => (
					<Link
						className="font-medium hover:underline"
						href={`/projects/${row.original.slug}`}
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: 'Project',
					placeholder: 'Search projects...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'owner',
				accessorKey: 'ownerName',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Owner" />,
				cell: ({ row }) => (
					<div className="min-w-36 text-sm">
						<div>{row.original.ownerName}</div>
						<div className="text-muted-foreground text-xs capitalize">
							{row.original.ownerType}
						</div>
					</div>
				),
				enableColumnFilter: false,
			},
			{
				id: 'type',
				accessorKey: 'type',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Type" />,
				cell: ({ row }) => (
					<Badge className="text-xs" variant="secondary">
						{
							PROJECT_TYPE_LABELS[
								normalizeProjectType(row.original.type)
							]
						}
					</Badge>
				),
				enableColumnFilter: false,
			},
			{
				id: 'status',
				accessorKey: 'status',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Status" />,
				cell: ({ row }) => (
					<LifecycleStatusBadge status={row.original.status} />
				),
				enableColumnFilter: false,
			},
			{
				id: 'moderationStatus',
				accessorKey: 'moderationStatus',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="Moderation" />
				),
				cell: ({ row }) => (
					<ModerationStatusBadge
						status={row.original.moderationStatus}
					/>
				),
				enableColumnFilter: false,
			},
			{
				id: 'downloads',
				accessorKey: 'totalDownloads',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="Downloads" />
				),
				cell: ({ row }) => (
					<div className="font-mono text-muted-foreground text-sm">
						{row.original.totalDownloads.toLocaleString()}
					</div>
				),
			},
			{
				id: 'version',
				accessorKey: 'latestVersionString',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Version" />,
				cell: ({ row }) =>
					row.original.latestVersionString ? (
						<Badge className="font-mono text-xs" variant="outline">
							v{row.original.latestVersionString}
						</Badge>
					) : (
						<span className="text-muted-foreground text-sm">-</span>
					),
			},
			{
				id: 'categories',
				accessorKey: 'categories',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="Categories" />
				),
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-1">
						{row.original.categories.slice(0, 2).map((category) => (
							<Badge
								className="text-xs"
								key={category._id}
								variant="outline"
							>
								{category.name}
							</Badge>
						))}
						{row.original.categories.length > 2 ? (
							<Badge className="text-xs" variant="outline">
								+{row.original.categories.length - 2}
							</Badge>
						) : null}
					</div>
				),
				filterFn: (row, _id, filterValue) => {
					if (!filterValue || filterValue.length === 0) {
						return true
					}
					const slugs = row.original.categories.map(
						(category) => category.slug,
					)
					return filterValue.some((slug: string) =>
						slugs.includes(slug),
					)
				},
				enableColumnFilter: false,
			},
			{
				id: 'createdAt',
				accessorKey: '_creationTime',
				header: ({
					column,
				}: {
					column: Column<AdminProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Created" />,
				cell: ({ row }) => (
					<div className="text-muted-foreground text-sm">
						{new Date(
							row.original._creationTime,
						).toLocaleDateString()}
					</div>
				),
			},
			{
				id: 'actions',
				cell: ({ row }) => (
					<ProjectActionsCell project={row.original} />
				),
				size: 32,
			},
		],
		[],
	)

	const table = useReactTable({
		data: projects,
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

	if (adminProjects === undefined) {
		return <DashboardTableSkeleton />
	}

	if (projects.length === 0) {
		return (
			<div className="min-w-0 space-y-6">
				<AdminPageHeader
					description="Review, publish, unpublish, and reject project submissions."
					title="Projects"
				/>
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<HugeiconsIcon
								className="size-7"
								icon={PuzzleIcon}
							/>
						</div>
						<div>
							<h2 className="font-semibold text-lg">
								No projects yet
							</h2>
							<p className="text-muted-foreground text-sm">
								Project submissions will appear here when users
								create them.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="min-w-0 space-y-6">
			<AdminPageHeader
				description="Review, publish, unpublish, and reject project submissions."
				title="Projects"
			/>
			<AdminProjectStats projects={projects} />
			<DataTable table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
