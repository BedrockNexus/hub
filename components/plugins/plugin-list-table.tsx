'use client'

import {
	Edit02Icon,
	GithubIcon,
	MoreHorizontalIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import type { Route } from 'next'
import Link from 'next/link'
import { useMemo } from 'react'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDataTable } from '@/hooks/use-data-table'
import type { DataTableFeatures } from '@/lib/data-table-features'
import { formatRegistryDate } from '@/lib/plugins/format-registry'

export interface PluginListRow {
	key: string
	name: string
	dashboardKey: string | null
	repository: { fullName: string; htmlUrl: string } | null
	version: string | null
	status: string
	statusLabel: string
	tone: 'default' | 'destructive' | 'outline'
	updatedAt: number
	manageHref: string | null
	publicHref: string | null
}

function PluginActions({ plugin }: { plugin: PluginListRow }) {
	if (!(plugin.manageHref || plugin.publicHref || plugin.repository)) {
		return null
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={(props) => (
					<Button {...props} size="icon-sm" variant="ghost">
						<HugeiconsIcon icon={MoreHorizontalIcon} />
						<span className="sr-only">
							Open menu for {plugin.name}
						</span>
					</Button>
				)}
			/>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuGroup>
					{plugin.manageHref ? (
						<DropdownMenuItem
							nativeButton={false}
							render={(props) => (
								<Link
									{...props}
									href={plugin.manageHref as Route}
								/>
							)}
						>
							<HugeiconsIcon icon={Edit02Icon} />
							Manage plugin
						</DropdownMenuItem>
					) : null}
					{plugin.publicHref ? (
						<DropdownMenuItem
							nativeButton={false}
							render={(props) => (
								<Link
									{...props}
									href={plugin.publicHref as Route}
								/>
							)}
						>
							<HugeiconsIcon icon={ViewIcon} />
							View public page
						</DropdownMenuItem>
					) : null}
					{plugin.repository ? (
						<DropdownMenuItem
							nativeButton={false}
							render={(props) => (
								<a
									{...props}
									href={plugin.repository?.htmlUrl}
									rel="noreferrer"
									target="_blank"
								/>
							)}
						>
							<HugeiconsIcon icon={GithubIcon} />
							Open repository
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function PluginListTable({ rows }: { rows: PluginListRow[] }) {
	const statusOptions = useMemo(
		() =>
			[...new Map(rows.map((row) => [row.status, row.statusLabel]))].map(
				([value, label]) => ({ value, label }),
			),
		[rows],
	)

	const columns = useMemo<ColumnDef<DataTableFeatures, PluginListRow>[]>(
		() => [
			{
				id: 'name',
				accessorKey: 'name',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Plugin" />
				),
				cell: ({ row }) => (
					<div className="flex min-w-56 flex-col gap-1">
						<div className="flex items-center gap-2">
							{row.original.manageHref ? (
								<Link
									className="truncate font-semibold hover:underline"
									href={row.original.manageHref as Route}
								>
									{row.original.name}
								</Link>
							) : (
								<span className="truncate font-semibold">
									{row.original.name}
								</span>
							)}
							{row.original.dashboardKey ? (
								<Badge
									className="font-mono"
									variant="secondary"
								>
									{row.original.dashboardKey}
								</Badge>
							) : null}
						</div>
						{row.original.repository ? (
							<a
								className="inline-flex max-w-72 items-center gap-1.5 truncate text-muted-foreground text-xs hover:text-foreground"
								href={row.original.repository.htmlUrl}
								rel="noreferrer"
								target="_blank"
							>
								<HugeiconsIcon
									className="size-3.5 shrink-0"
									icon={GithubIcon}
								/>
								<span className="truncate">
									{row.original.repository.fullName}
								</span>
							</a>
						) : (
							<span className="text-muted-foreground text-xs">
								Repository unavailable
							</span>
						)}
					</div>
				),
				meta: {
					label: 'Plugin',
					placeholder: 'Search plugins…',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'version',
				accessorFn: (row) => row.version ?? '',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Version" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.version ?? 'No version'}
					</span>
				),
				enableSorting: false,
			},
			{
				id: 'status',
				accessorKey: 'status',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Status" />
				),
				cell: ({ row }) => (
					<Badge variant={row.original.tone}>
						{row.original.statusLabel}
					</Badge>
				),
				meta: {
					label: 'Status',
					variant: 'select',
					options: statusOptions,
				},
				enableColumnFilter: true,
			},
			{
				id: 'updatedAt',
				accessorKey: 'updatedAt',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Updated" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{formatRegistryDate(row.original.updatedAt)}
					</span>
				),
			},
			{
				id: 'actions',
				cell: ({ row }) => <PluginActions plugin={row.original} />,
				enableSorting: false,
				enableHiding: false,
				size: 32,
			},
		],
		[statusOptions],
	)

	const { table } = useDataTable({
		mode: 'client',
		data: rows,
		columns,
		getRowId: (row) => row.key,
		initialState: {
			pagination: { pageIndex: 0, pageSize: 10 },
			sorting: [{ id: 'updatedAt', desc: true }],
		},
	})

	return (
		<DataTable table={table}>
			<DataTableToolbar table={table} />
		</DataTable>
	)
}
