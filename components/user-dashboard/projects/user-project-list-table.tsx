'use client'

import { PuzzleIcon, StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Column, ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useMemo } from 'react'
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
import { DashboardEmptyState } from '@/components/user-dashboard/dashboard-empty-state'
import { DashboardTableSkeleton } from '@/components/user-dashboard/dashboard-table-skeleton'
import {
	ListingPublicationBadge,
	ListingReviewBadge,
} from '@/components/user-dashboard/listing-review-state'
import { ListingRowActions } from '@/components/user-dashboard/listing-row-actions'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useDataTable } from '@/hooks/use-data-table'
import { contentEditHref, contentHref } from '@/lib/content-routes'
import {
	type CreatorListingInput,
	creatorListingState,
	PUBLICATION_LABELS,
	REVIEW_LABELS,
} from '@/lib/creator-listing-state'
import type { DataTableFeatures } from '@/lib/data-table-features'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
	PROJECT_TYPE_PLURAL_LABELS,
	PROJECT_TYPES,
	type ProjectType,
	type StoredProjectType,
} from '@/lib/project-artifacts'

interface ProjectCategory {
	_id: Id<'projectCategories'>
	name: string
	slug: string
}

type ProjectLifecycleStatus = 'draft' | 'published' | 'under_review'

interface ProjectRow extends CreatorListingInput {
	_id: Id<'projects'>
	name: string
	slug: string
	type: StoredProjectType
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

function ProjectStatsBar({
	items,
	type,
}: {
	items: ProjectRow[]
	type?: ProjectType
}) {
	const plural = type ? PROJECT_TYPE_PLURAL_LABELS[type] : 'Listings'
	const totalItems = items.length
	const publishedItems = items.filter(
		(i) => creatorListingState(i).published,
	).length
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
				<StatLabel>Total {plural}</StatLabel>
				<StatValue>{totalItems}</StatValue>
				<StatDescription>
					{publishedItems} published . {totalItems - publishedItems}{' '}
					unpublished
				</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Total Downloads</StatLabel>
				<StatValue>{totalDownloads.toLocaleString()}</StatValue>
				<StatDescription>
					across all {plural.toLowerCase()}
				</StatDescription>
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
	type?: ProjectType
	createHref?: string
	createLabel?: string
	emptyDescription?: string
	emptyTitle?: string
	organizationId?: string
}

export function ProjectListTable({
	type,
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
	const categories = useQuery(api.functions.projects.categories.list, {
		projectType: type,
	})
	const deleteContent = useMutation(api.functions.projects.projects.remove)

	const projects = organizationId ? organizationContent : personalContent

	const contentItems: ProjectRow[] = useMemo(() => {
		if (!projects) {
			return []
		}
		return projects
			.filter((item) => !type || normalizeProjectType(item.type) === type)
			.map((c) => ({
				...c,
				categories: c.categories,
			}))
	}, [projects, type])

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
		async (contentId: Id<'projects'>) => {
			await deleteContent({ id: contentId })
		},
		[deleteContent],
	)

	const columns = useMemo<ColumnDef<DataTableFeatures, ProjectRow>[]>(() => {
		const columns: ColumnDef<DataTableFeatures, ProjectRow>[] = [
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
					column: Column<DataTableFeatures, ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Name" />,
				cell: ({ row }) => (
					<Link
						className="font-medium hover:underline"
						href={contentEditHref(
							row.original.type,
							row.original._id,
						)}
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: 'Name',
					placeholder: type
						? `Search ${PROJECT_TYPE_PLURAL_LABELS[type].toLowerCase()}...`
						: 'Search listings...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'status',
				accessorFn: (row) => creatorListingState(row).publication,
				header: ({
					column,
				}: {
					column: Column<DataTableFeatures, ProjectRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Status" />,
				cell: ({ row }) => (
					<ListingPublicationBadge
						status={creatorListingState(row.original).publication}
					/>
				),
				meta: {
					label: 'Status',
					variant: 'multiSelect',
					options: Object.entries(PUBLICATION_LABELS).map(
						([value, label]) => ({ value, label }),
					),
				},
				enableColumnFilter: true,
			},
			{
				id: 'review',
				accessorFn: (row) => creatorListingState(row).review,
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						label="Review status"
					/>
				),
				cell: ({ row }) => (
					<div className="space-y-1">
						<ListingReviewBadge
							status={creatorListingState(row.original).review}
						/>
						{row.original.hasPendingVersions ? (
							<p className="text-muted-foreground text-xs">
								Version submission
							</p>
						) : null}
					</div>
				),
				meta: {
					label: 'Review status',
					variant: 'multiSelect',
					options: Object.entries(REVIEW_LABELS).map(
						([value, label]) => ({ value, label }),
					),
				},
				enableColumnFilter: true,
			},
			{
				id: 'type',
				accessorKey: 'type',
				header: ({
					column,
				}: {
					column: Column<DataTableFeatures, ProjectRow, unknown>
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
				meta: {
					label: 'Type',
					variant: 'multiSelect',
					options: PROJECT_TYPES.map((value) => ({
						label: PROJECT_TYPE_LABELS[value],
						value,
					})),
				},
				enableColumnFilter: true,
			},
			{
				id: 'downloads',
				accessorKey: 'totalDownloads',
				header: ({
					column,
				}: {
					column: Column<DataTableFeatures, ProjectRow, unknown>
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
					column: Column<DataTableFeatures, ProjectRow, unknown>
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
					column: Column<DataTableFeatures, ProjectRow, unknown>
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
					column: Column<DataTableFeatures, ProjectRow, unknown>
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
					column: Column<DataTableFeatures, ProjectRow, unknown>
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
					const item = row.original
					const state = creatorListingState(item)
					const editHref = contentEditHref(item.type, item._id)
					return (
						<ListingRowActions
							deletion={
								state.locked
									? undefined
									: {
											name: item.name,
											confirmText: item.slug,
											description:
												'This permanently deletes the listing, its releases, reviews and gallery. Recorded submission history and its images are retained.',
											onDelete: () =>
												handleDelete(item._id),
										}
							}
							editHref={editHref}
							id={item._id}
							name={item.name}
							publicHref={
								state.published
									? contentHref(
											item.type,
											item.slug,
											item._id,
										)
									: undefined
							}
							reviewHref={`${editHref}/${item.hasPendingVersions && state.review === 'pending' ? 'versions' : 'review'}`}
						/>
					)
				},
				size: 32,
			},
		]
		return columns.filter((column) => !type || column.id !== 'type')
	}, [availableCategories, handleDelete, type])

	const { table } = useDataTable({
		mode: 'client',
		data: contentItems,
		columns,
		initialState: {
			pagination: {
				pageIndex: 0,
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
			<ProjectStatsBar items={contentItems} type={type} />

			<DataTable table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
