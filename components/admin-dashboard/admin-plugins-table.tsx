'use client'

import {
	CheckmarkCircle02Icon,
	Copy01Icon,
	MoreHorizontalIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import Link from 'next/link'
import { useMemo } from 'react'
import { toast } from 'sonner'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { AdminPageHeader } from '@/components/admin-dashboard/admin-page-header'
import {
	PluginReviewStatusBadge,
	reviewStatusLabels,
} from '@/components/admin-dashboard/plugin-review-status'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DashboardTableSkeleton } from '@/components/user-dashboard/dashboard-table-skeleton'
import { api } from '@/convex/_generated/api'
import { useDataTable } from '@/hooks/use-data-table'
import type { DataTableFeatures } from '@/lib/data-table-features'
import { formatDate } from '@/lib/format'
import {
	pluginLifecycleStatus,
	pluginModerationStatus,
} from '@/lib/plugins/moderation-state'

type PluginRow = FunctionReturnType<
	typeof api.functions.plugins.projects.listAdmin
>[number]
function PluginActionsCell({ plugin }: { plugin: PluginRow }) {
	const copyId = async () => {
		try {
			await navigator.clipboard.writeText(plugin.projectId)
			toast.success('Plugin ID copied')
		} catch {
			toast.error('Failed to copy plugin ID')
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={(props) => (
					<Button
						{...props}
						aria-label={`Actions for ${plugin.name}`}
						size="icon"
						variant="ghost"
					>
						<HugeiconsIcon
							aria-hidden
							className="size-4"
							icon={MoreHorizontalIcon}
						/>
					</Button>
				)}
			/>
			<DropdownMenuContent align="end" className="w-48">
				{plugin.status === 'published' &&
				plugin.visibility === 'public' ? (
					<DropdownMenuItem
						nativeButton={false}
						render={(props) => (
							<Link {...props} href={`/plugins/${plugin.slug}`} />
						)}
					>
						<HugeiconsIcon
							aria-hidden
							className="size-4"
							icon={ViewIcon}
						/>
						View plugin
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					nativeButton={false}
					render={(props) => (
						<Link
							{...props}
							href={`/admin/plugins/${plugin.projectId}`}
						/>
					)}
				>
					<HugeiconsIcon
						aria-hidden
						className="size-4"
						icon={CheckmarkCircle02Icon}
					/>
					Review submission
				</DropdownMenuItem>
				<DropdownMenuItem onClick={copyId}>
					<HugeiconsIcon
						aria-hidden
						className="size-4"
						icon={Copy01Icon}
					/>
					Copy plugin ID
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function AdminPluginsTable() {
	const plugins = useQuery(api.functions.plugins.projects.listAdmin, {})
	const data = useMemo(() => plugins ?? [], [plugins])
	const columns = useMemo<ColumnDef<DataTableFeatures, PluginRow>[]>(
		() => [
			{
				accessorKey: 'name',
				id: 'name',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Plugin" />
				),
				cell: ({ row }) => (
					<div>
						<span className="font-medium">{row.original.name}</span>
						<p className="text-muted-foreground text-xs">
							{row.original.repository}
						</p>
					</div>
				),
				meta: {
					label: 'Plugin',
					placeholder: 'Search plugins...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				accessorKey: 'software',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Software" />
				),
			},
			{
				accessorFn: (row) =>
					row.status === 'archived'
						? 'archived'
						: pluginLifecycleStatus(row),
				id: 'status',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Status" />
				),
				cell: ({ row }) =>
					row.original.status === 'archived' ? (
						<Badge variant="secondary">Archived</Badge>
					) : (
						<LifecycleStatusBadge
							status={pluginLifecycleStatus(row.original)}
						/>
					),
				meta: {
					label: 'Status',
					variant: 'multiSelect',
					options: [
						'draft',
						'under_review',
						'published',
						'archived',
					].map((value) => ({
						label:
							value === 'under_review' ? 'Under review' : value,
						value,
					})),
				},
				enableColumnFilter: true,
				filterFn: (row, id, value: string[]) =>
					!value.length || value.includes(row.getValue(id)),
			},
			{
				accessorKey: 'reviewStatus',
				id: 'reviewStatus',
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						label="Review status"
					/>
				),
				cell: ({ row }) => {
					const status = row.original.reviewStatus ?? 'notSubmitted'
					return (
						<div className="space-y-1">
							<PluginReviewStatusBadge status={status} />
							{row.original.reviewVersion ? (
								<p className="font-mono text-muted-foreground text-xs">
									v{row.original.reviewVersion}
								</p>
							) : null}
						</div>
					)
				},
				meta: {
					label: 'Review status',
					variant: 'multiSelect',
					options: Object.entries(reviewStatusLabels).map(
						([value, label]) => ({ value, label }),
					),
				},
				enableColumnFilter: true,
				filterFn: (row, id, value: string[]) =>
					!value.length || value.includes(row.getValue(id)),
			},
			{
				id: 'moderationStatus',
				accessorFn: (row) => pluginModerationStatus(row),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Moderation" />
				),
				cell: ({ row }) => (
					<ModerationStatusBadge
						status={pluginModerationStatus(row.original)}
					/>
				),
				meta: {
					label: 'Moderation',
					variant: 'multiSelect',
					options: [
						{ value: 'approved', label: 'Approved' },
						{ value: 'pending', label: 'Pending' },
						{ value: 'flagged', label: 'Flagged' },
						{ value: 'rejected', label: 'Rejected' },
					],
				},
				enableColumnFilter: true,
				filterFn: (row, id, value: string[]) =>
					!value.length || value.includes(row.getValue(id)),
			},
			{ accessorKey: 'visibility', header: 'Visibility' },
			{
				accessorKey: 'latestVersion',
				header: 'Latest version',
				cell: ({ row }) => row.original.latestVersion ?? '-',
			},
			{
				accessorKey: 'downloadCount',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Downloads" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums">
						{row.original.downloadCount.toLocaleString()}
					</span>
				),
			},
			{
				accessorKey: 'updatedAt',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Updated" />
				),
				cell: ({ row }) => formatDate(row.original.updatedAt),
			},
			{
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => <PluginActionsCell plugin={row.original} />,
				enableSorting: false,
				size: 48,
			},
		],
		[],
	)
	const { table } = useDataTable({
		mode: 'client',
		data,
		columns,
		initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
	})
	return (
		<div className="min-w-0 space-y-6">
			<AdminPageHeader
				description="Browse plugins across all publishing states. Search, sort, and filter the catalog."
				title="Plugins"
			/>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">
					{plugins === undefined
						? 'Loading plugins...'
						: `${plugins.length} plugins (up to 250 most recent)`}
				</p>
			</div>
			{plugins === undefined ? (
				<DashboardTableSkeleton />
			) : (
				<DataTable table={table}>
					<DataTableToolbar table={table} />
				</DataTable>
			)}
		</div>
	)
}
