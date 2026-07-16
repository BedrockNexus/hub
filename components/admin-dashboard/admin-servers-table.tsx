'use client'

import {
	Copy01Icon,
	MoreHorizontalIcon,
	ServerStack03Icon,
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
import {
	Status,
	StatusIndicator,
	StatusLabel,
} from '@/components/dice-ui/status'
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

interface AdminServerCategory {
	_id: Id<'serverCategories'>
	name: string
	slug: string
}

type ServerLifecycleStatus = 'draft' | 'published' | 'under_review'

interface AdminServerRow {
	_id: Id<'servers'>
	_creationTime: number
	name: string
	slug: string
	ipAddress: string
	port: number
	status?: ServerLifecycleStatus
	moderationStatus?: ModerationStatus
	ownerType: 'user' | 'organization'
	ownerName: string
	registeredByName: string
	categories: AdminServerCategory[]
	logoUrl?: string
	averageRating: number
	reviewCount: number
	totalIpCopies: number
	online: boolean
	playerCount: number
	maxPlayers: number
	lastChecked?: number
	updatedAt?: number
}

function ServerOnlineBadge({ server }: { server: AdminServerRow }) {
	return (
		<Status variant={server.online ? 'success' : 'default'}>
			{server.online ? <StatusIndicator /> : null}
			<StatusLabel>
				{server.online
					? `Online ${server.playerCount}/${server.maxPlayers}`
					: 'Offline'}
			</StatusLabel>
		</Status>
	)
}

function AdminServerStats({ servers }: { servers: AdminServerRow[] }) {
	const publishedCount = servers.filter(
		(server) => server.status === 'published',
	).length
	const reviewCount = servers.filter(
		(server) =>
			server.status === 'under_review' ||
			(server.status === 'published' &&
				server.moderationStatus !== 'approved'),
	).length
	const onlineCount = servers.filter((server) => server.online).length

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Stat>
				<StatLabel>Total Servers</StatLabel>
				<StatValue>{servers.length}</StatValue>
				<StatDescription>{publishedCount} published</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Published</StatLabel>
				<StatValue>{publishedCount}</StatValue>
				<StatDescription>Visible on public listings</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Online</StatLabel>
				<StatValue>{onlineCount}</StatValue>
				<StatDescription>Responding to status checks</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Needs Review</StatLabel>
				<StatValue>{reviewCount}</StatValue>
				<StatDescription>
					Unreviewed or flagged listings
				</StatDescription>
			</Stat>
		</div>
	)
}

function ServerActionsCell({ server }: { server: AdminServerRow }) {
	const copyId = async () => {
		try {
			await navigator.clipboard.writeText(server._id)
			toast.success('Server ID copied')
		} catch {
			toast.error('Failed to copy server ID')
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
							href={`/admin/servers/${server._id}`}
						/>
					)}
				>
					<HugeiconsIcon className="size-4" icon={ViewIcon} />
					Review Submission
				</DropdownMenuItem>
				<DropdownMenuItem onClick={copyId}>
					<HugeiconsIcon className="size-4" icon={Copy01Icon} />
					Copy Server ID
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function AdminServersTable() {
	const adminServers = useQuery(api.functions.servers.servers.listAdmin, {
		limit: 250,
	})
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

	const servers = useMemo(
		() => (adminServers ?? []) as AdminServerRow[],
		[adminServers],
	)

	const columns = useMemo<ColumnDef<AdminServerRow>[]>(
		() => [
			{
				id: 'icon',
				header: 'Icon',
				cell: ({ row }) =>
					row.original.logoUrl ? (
						<Image
							alt={`${row.original.name} logo`}
							className="rounded object-cover"
							height={32}
							src={row.original.logoUrl}
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
					column: Column<AdminServerRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Server" />,
				cell: ({ row }) => (
					<div className="min-w-48">
						<Link
							className="font-medium hover:underline"
							href={`/servers/${row.original.slug}`}
						>
							{row.original.name}
						</Link>
						<div className="text-muted-foreground text-xs">
							{row.original.ipAddress}:{row.original.port}
						</div>
					</div>
				),
				meta: {
					label: 'Server',
					placeholder: 'Search servers...',
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
					column: Column<AdminServerRow, unknown>
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
				id: 'status',
				accessorKey: 'status',
				header: ({
					column,
				}: {
					column: Column<AdminServerRow, unknown>
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
					column: Column<AdminServerRow, unknown>
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
				id: 'online',
				accessorFn: (row) => (row.online ? 'online' : 'offline'),
				header: ({
					column,
				}: {
					column: Column<AdminServerRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Ping" />,
				cell: ({ row }) => <ServerOnlineBadge server={row.original} />,
				enableColumnFilter: false,
			},
			{
				id: 'categories',
				accessorKey: 'categories',
				header: ({
					column,
				}: {
					column: Column<AdminServerRow, unknown>
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
				enableColumnFilter: false,
			},
			{
				id: 'createdAt',
				accessorKey: '_creationTime',
				header: ({
					column,
				}: {
					column: Column<AdminServerRow, unknown>
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
				cell: ({ row }) => <ServerActionsCell server={row.original} />,
				size: 32,
			},
		],
		[],
	)

	const table = useReactTable({
		data: servers,
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

	if (adminServers === undefined) {
		return <DashboardTableSkeleton />
	}

	if (servers.length === 0) {
		return (
			<div className="space-y-6">
				<AdminPageHeader
					description="Moderate published servers and resolve listings that need review."
					title="Servers"
				/>
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<HugeiconsIcon
								className="size-7"
								icon={ServerStack03Icon}
							/>
						</div>
						<div>
							<h2 className="font-semibold text-lg">
								No servers yet
							</h2>
							<p className="text-muted-foreground text-sm">
								Registered server listings will appear here.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<AdminPageHeader
				description="Moderate published servers and resolve listings that need review."
				title="Servers"
			/>
			<AdminServerStats servers={servers} />
			<DataTable table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
