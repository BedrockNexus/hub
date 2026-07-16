'use client'

import {
	Copy01Icon,
	Delete02Icon,
	Flag01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	RefreshIcon,
	ServerStack03Icon,
	ViewIcon,
	ViewOffSlashIcon,
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
import { useAction, useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LifecycleStatusBadge } from '@/components/admin-dashboard/admin-content-status'
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
import { CopyableAddress } from '@/components/servers/copyable-address'
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
import {
	getSoftwareClassificationLabel,
	type ServerSoftwareClassification,
} from '@/lib/bedrock-api'

// Type for category from Convex
interface Category {
	_id: Id<'serverCategories'>
	name: string
	slug: string
}

type ServerLifecycleStatus = 'draft' | 'published' | 'under_review'
type OwnerServerLifecycleStatus = Extract<
	ServerLifecycleStatus,
	'draft' | 'published'
>

// Type for server table display
interface ServerRow {
	_id: Id<'servers'>
	name: string
	slug: string
	ipAddress: string
	port: number
	smallDescription: string
	categories: (Category | null)[]
	logoUrl?: string
	bannerUrl?: string
	status?: ServerLifecycleStatus
	_creationTime: number
	updatedAt?: number
	// Status from ping (client-side state)
	pingStatus?: 'online' | 'offline' | 'checking'
	playerCount?: number
	maxPlayers?: number
	softwareClassification?: ServerSoftwareClassification
}

function ServerRowActionsCell({
	server,
	onRefresh,
	onSetLifecycleStatus,
	onDelete,
}: {
	server: ServerRow
	onRefresh: () => void
	onSetLifecycleStatus: (status: OwnerServerLifecycleStatus) => Promise<void>
	onDelete: () => Promise<void>
}) {
	const [isDeleting, setIsDeleting] = useState(false)
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

	const handleDeleteServerClick = async () => {
		setIsDeleting(true)
		try {
			await onDelete()
		} finally {
			setIsDeleting(false)
		}
	}

	const handleCopyServerId = async () => {
		try {
			await navigator.clipboard.writeText(server._id)
			toast.success('Server ID copied')
		} catch {
			toast.error('Failed to copy server ID')
		}
	}

	const handleSetLifecycleStatus = async (
		status: OwnerServerLifecycleStatus,
	) => {
		setIsUpdatingStatus(true)
		try {
			await onSetLifecycleStatus(status)
		} finally {
			setIsUpdatingStatus(false)
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
					{server.status === 'draft' ? (
						<DropdownMenuItem
							disabled={isUpdatingStatus}
							onClick={() =>
								handleSetLifecycleStatus('published')
							}
						>
							<HugeiconsIcon className="size-4" icon={ViewIcon} />
							Publish Server
						</DropdownMenuItem>
					) : null}
					{server.status === 'published' ? (
						<DropdownMenuItem
							disabled={isUpdatingStatus}
							onClick={() => handleSetLifecycleStatus('draft')}
						>
							<HugeiconsIcon
								className="size-4"
								icon={ViewOffSlashIcon}
							/>
							Move to Draft
						</DropdownMenuItem>
					) : null}
					{server.status === 'under_review' ? (
						<DropdownMenuItem disabled>
							<HugeiconsIcon
								className="size-4"
								icon={Flag01Icon}
							/>
							Under Review
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem onClick={onRefresh}>
						<HugeiconsIcon className="size-4" icon={RefreshIcon} />
						Refresh Status
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleCopyServerId}>
						<HugeiconsIcon className="size-4" icon={Copy01Icon} />
						Copy Server ID
					</DropdownMenuItem>
					<DropdownMenuItem
						nativeButton={false}
						render={(props) => (
							<Link
								{...props}
								href={`/dashboard/servers/${server.slug}/edit`}
							>
								<HugeiconsIcon
									className="size-4"
									icon={PencilEdit01Icon}
								/>
								Edit
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
						<strong>{server.name}</strong>. This action cannot be
						undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						disabled={isDeleting}
						onClick={handleDeleteServerClick}
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

// ─── Inline Clickable Status Badge ──────────────────────────────────────────

function ClickableStatusBadge({
	status,
	playerCount,
	maxPlayers,
	softwareClassification,
	onRefresh,
}: {
	status?: 'online' | 'offline' | 'checking'
	playerCount?: number
	maxPlayers?: number
	softwareClassification?: ServerSoftwareClassification
	onRefresh: () => void
}) {
	if (status === 'checking') {
		return (
			<Status variant="warning">
				<Spinner className="size-3" />
				<StatusLabel>Checking</StatusLabel>
			</Status>
		)
	}

	if (!status) {
		return (
			<Status variant="default">
				<StatusLabel>Unknown</StatusLabel>
			</Status>
		)
	}
	if (
		softwareClassification === 'geyser_likely' ||
		softwareClassification === 'ambiguous'
	) {
		return (
			<button
				className="cursor-pointer transition-opacity hover:opacity-80"
				onClick={onRefresh}
				title="Click to refresh status"
				type="button"
			>
				<Status
					variant={
						softwareClassification === 'geyser_likely'
							? 'error'
							: 'warning'
					}
				>
					<StatusIndicator />
					<StatusLabel>
						{getSoftwareClassificationLabel(softwareClassification)}
					</StatusLabel>
				</Status>
			</button>
		)
	}

	return (
		<button
			className="cursor-pointer transition-opacity hover:opacity-80"
			onClick={onRefresh}
			title="Click to refresh status"
			type="button"
		>
			<Status variant={status === 'online' ? 'success' : 'error'}>
				<StatusIndicator />
				<StatusLabel>
					{status === 'online'
						? `Online${
								playerCount !== undefined &&
								maxPlayers !== undefined
									? ` ${playerCount}/${maxPlayers}`
									: ''
							}`
						: 'Offline'}
				</StatusLabel>
			</Status>
		</button>
	)
}

// ─── Stats Bar ──────────────────────────────────────────────────────────────

function ServerStatsBar({ servers }: { servers: ServerRow[] }) {
	const totalServers = servers.length
	const onlineServers = servers.filter(
		(s) => s.pingStatus === 'online',
	).length
	const totalPlayers = servers.reduce(
		(sum, s) =>
			sum + (s.pingStatus === 'online' ? (s.playerCount ?? 0) : 0),
		0,
	)

	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<Stat>
				<StatLabel>Total Servers</StatLabel>
				<StatValue>{totalServers}</StatValue>
			</Stat>
			<Stat>
				<StatLabel>Online Now</StatLabel>
				<StatValue>
					{onlineServers}/{totalServers}
				</StatValue>
				<StatDescription>
					{totalServers - onlineServers > 0
						? `${totalServers - onlineServers} offline`
						: 'All servers online'}
				</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Players Online</StatLabel>
				<StatValue>{totalPlayers}</StatValue>
			</Stat>
		</div>
	)
}

export function ServerListTable() {
	// Fetch servers from Convex
	const myServers = useQuery(api.functions.servers.servers.listMyServers)
	const categories = useQuery(api.functions.servers.categories.list, {})
	const updateServer = useMutation(api.functions.servers.servers.update)
	const deleteServer = useMutation(api.functions.servers.servers.remove)
	const refreshServerStatus = useAction(
		api.functions.servers.status.refreshStatus,
	)

	// Get server IDs for batch status query
	const serverIds = useMemo(
		() => myServers?.map((s) => s._id) ?? [],
		[myServers],
	)

	// Fetch stored statuses from database
	const storedStatuses = useQuery(
		api.functions.servers.status.getStatusBatch,
		serverIds.length > 0 ? { serverIds } : 'skip',
	)

	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [manualStatuses, setManualStatuses] = useState<
		Record<
			string,
			{
				status: 'online' | 'offline' | 'checking'
				playerCount?: number
				maxPlayers?: number
				softwareClassification?: ServerSoftwareClassification
			}
		>
	>({})

	// Transform Convex data to table format
	const servers: ServerRow[] = useMemo(() => {
		if (!myServers) {
			return []
		}
		return myServers.map((server) => {
			// Prefer manual refresh status, fall back to stored status
			const manualStatus = manualStatuses[server._id]
			const storedStatus = storedStatuses?.[server._id]

			let status: 'online' | 'offline' | 'checking' | undefined =
				manualStatus?.status
			if (!status && storedStatus) {
				status = storedStatus.online ? 'online' : 'offline'
			}

			return {
				...server,
				categories: server.categories,
				pingStatus: status,
				playerCount:
					manualStatus?.playerCount ?? storedStatus?.playerCount,
				maxPlayers:
					manualStatus?.maxPlayers ?? storedStatus?.maxPlayers,
				softwareClassification:
					manualStatus?.softwareClassification ??
					storedStatus?.softwareClassification,
			}
		})
	}, [myServers, storedStatuses, manualStatuses])

	// Available categories for filtering
	const availableCategories = useMemo(() => {
		if (!categories) {
			return []
		}
		return categories.map((cat) => ({
			label: cat.name,
			value: cat.slug,
		}))
	}, [categories])

	// Manual refresh server status and persist it for public/admin views.
	const handleRefreshStatus = useCallback(
		async (serverId: Id<'servers'>) => {
			setManualStatuses((prev) => ({
				...prev,
				[serverId]: { status: 'checking' },
			}))

			try {
				const data = await refreshServerStatus({ serverId })

				setManualStatuses((prev) => ({
					...prev,
					[serverId]: {
						status: data.status,
						playerCount: data.playerCount,
						maxPlayers: data.maxPlayers,
						softwareClassification: data.softwareClassification,
					},
				}))
				if (
					data.softwareClassification === 'geyser_likely' ||
					data.softwareClassification === 'ambiguous'
				) {
					toast.warning(
						data.softwareReasons?.[0] ||
							getSoftwareClassificationLabel(
								data.softwareClassification,
							),
					)
				}
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: 'Failed to refresh server status',
				)
				setManualStatuses((prev) => ({
					...prev,
					[serverId]: { status: 'offline' },
				}))
			}
		},
		[refreshServerStatus],
	)

	// Handler for deleting a server
	const handleDeleteServer = useCallback(
		async (serverId: Id<'servers'>, serverName: string) => {
			try {
				await deleteServer({ id: serverId })
				toast.success(`${serverName} has been deleted`)
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: 'Failed to delete server',
				)
			}
		},
		[deleteServer],
	)

	const handleSetLifecycleStatus = useCallback(
		async (
			serverId: Id<'servers'>,
			serverName: string,
			status: OwnerServerLifecycleStatus,
		) => {
			try {
				await updateServer({ id: serverId, status })
				toast.success(
					status === 'published'
						? `${serverName} is now published`
						: `${serverName} moved to draft`,
				)
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: 'Failed to update server status',
				)
			}
		},
		[updateServer],
	)

	const columns = useMemo<ColumnDef<ServerRow>[]>(
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
				size: 48,
				enableSorting: false,
			},
			{
				id: 'name',
				accessorKey: 'name',
				header: ({
					column,
				}: {
					column: Column<ServerRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Name" />,
				cell: ({ row }) => (
					<Link
						className="font-medium hover:underline"
						href={`/dashboard/servers/${row.original.slug}/edit`}
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: 'Name',
					placeholder: 'Search servers...',
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
					column: Column<ServerRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Status" />,
				cell: ({ row }) => (
					<LifecycleStatusBadge status={row.original.status} />
				),
				meta: {
					label: 'Status',
					variant: 'multiSelect',
					options: [
						{ label: 'Draft', value: 'draft' },
						{ label: 'Published', value: 'published' },
						{ label: 'Under Review', value: 'under_review' },
					],
				},
				enableColumnFilter: true,
			},
			{
				id: 'pingStatus',
				accessorKey: 'pingStatus',
				header: ({
					column,
				}: {
					column: Column<ServerRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Ping" />,
				cell: ({ row }) => {
					const server = row.original
					return (
						<ClickableStatusBadge
							maxPlayers={server.maxPlayers}
							onRefresh={() => {
								handleRefreshStatus(server._id)
								toast.info(`Checking ${server.name} status...`)
							}}
							playerCount={server.playerCount}
							softwareClassification={
								server.softwareClassification
							}
							status={server.pingStatus}
						/>
					)
				},
				meta: {
					label: 'Ping',
					variant: 'multiSelect',
					options: [
						{ label: 'Online', value: 'online' },
						{ label: 'Offline', value: 'offline' },
					],
				},
				enableColumnFilter: true,
			},
			{
				id: 'ipAddress',
				accessorKey: 'ipAddress',
				header: ({
					column,
				}: {
					column: Column<ServerRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="IP Address" />
				),
				cell: ({ row }) => {
					const address = `${row.original.ipAddress}:${row.original.port || 19_132}`
					return <CopyableAddress address={address} />
				},
			},
			{
				id: 'categories',
				accessorKey: 'categories',
				header: ({
					column,
				}: {
					column: Column<ServerRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="Categories" />
				),
				cell: ({ row }) => {
					const categories = (row.original.categories || []).filter(
						Boolean,
					) as Category[]
					return (
						<div className="flex flex-wrap gap-1">
							{categories.slice(0, 2).map((category) => (
								<Badge
									className="text-xs"
									key={category._id}
									variant="outline"
								>
									{category.name}
								</Badge>
							))}
							{categories.length > 2 && (
								<Badge className="text-xs" variant="outline">
									+{categories.length - 2}
								</Badge>
							)}
						</div>
					)
				},
				filterFn: (row, _id, filterValue) => {
					if (!filterValue || filterValue.length === 0) {
						return true
					}

					const serverCategories = (
						row.original.categories || []
					).filter(Boolean) as Category[]
					const serverCategorySlugs = serverCategories.map(
						(cat) => cat.slug,
					)

					return filterValue.some((selectedSlug: string) =>
						serverCategorySlugs.includes(selectedSlug),
					)
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
					column: Column<ServerRow, unknown>
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
					const server = row.original
					return (
						<ServerRowActionsCell
							onDelete={() =>
								handleDeleteServer(server._id, server.name)
							}
							onRefresh={() => {
								handleRefreshStatus(server._id)
								toast.info(`Checking ${server.name} status...`)
							}}
							onSetLifecycleStatus={(status) =>
								handleSetLifecycleStatus(
									server._id,
									server.name,
									status,
								)
							}
							server={server}
						/>
					)
				},
				size: 32,
			},
		],
		[
			availableCategories,
			handleDeleteServer,
			handleRefreshStatus,
			handleSetLifecycleStatus,
		],
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

	// Loading state
	if (myServers === undefined) {
		return <DashboardTableSkeleton />
	}

	// Empty state
	if (servers.length === 0) {
		return (
			<DashboardEmptyState
				createHref="/dashboard/servers/add"
				createLabel="Add Your First Server"
				description="Add your first Minecraft Bedrock server to start tracking player count and grow your community."
				icon={ServerStack03Icon}
				title="No servers yet"
			/>
		)
	}

	return (
		<div className="space-y-6">
			{/* Stats Bar */}
			<ServerStatsBar servers={servers} />

			<DataTable table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
