'use client'

import {
	Add01Icon,
	Copy01Icon,
	Delete02Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	RefreshIcon,
	ServerStack03Icon,
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
import { useParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import {
	Status,
	StatusIndicator,
	StatusLabel,
} from '@/components/dice-ui/status'
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

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useFullOrganization } from '@/hooks/use-organization'
import {
	getSoftwareClassificationLabel,
	type ServerSoftwareClassification,
} from '@/lib/bedrock-api'

// Type for server table display
interface ServerRow {
	_id: Id<'servers'>
	name: string
	slug: string
	ipAddress: string
	port: number
	smallDescription: string
	logoUrl?: string
	averageRating: number
	reviewCount: number
	lifecycleStatus?: 'draft' | 'published' | 'under_review'
	_creationTime: number
	updatedAt?: number
	categoryIds: Id<'serverCategories'>[]
	status?: 'online' | 'offline' | 'checking'
	playerCount?: number
	maxPlayers?: number
	softwareClassification?: ServerSoftwareClassification
}

const LOADING_ROW_KEYS = [
	'loading-row-1',
	'loading-row-2',
	'loading-row-3',
] as const

function ServerRowActionsCell({
	server,
	onRefresh,
	onDelete,
}: {
	server: ServerRow
	onRefresh: () => void
	onDelete: () => Promise<void>
}) {
	const [isDeleting, setIsDeleting] = useState(false)

	const handleDeleteClick = async () => {
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
		} catch (error) {
			console.error('Failed to copy server ID', error)
			toast.error('Failed to copy server ID')
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
						onClick={handleDeleteClick}
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

export default function OrganizationServersPage() {
	const params = useParams()
	const slug = params.slug as string
	const { organization, loading: orgLoading } = useFullOrganization(slug)

	const orgServers = useQuery(
		api.functions.servers.servers.listByOrganization,
		organization?.id ? { organizationId: organization.id } : 'skip',
	)
	const deleteServer = useMutation(api.functions.servers.servers.remove)
	const refreshServerStatus = useAction(
		api.functions.servers.status.refreshStatus,
	)

	// Get server IDs for batch status query
	const serverIds = useMemo(
		() => orgServers?.map((s) => s._id) ?? [],
		[orgServers],
	)

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

	// Transform data to table format
	const servers: ServerRow[] = useMemo(() => {
		if (!orgServers) {
			return []
		}
		return orgServers.map((server) => {
			const manualStatus = manualStatuses[server._id]
			const storedStatus = storedStatuses?.[server._id]

			let status: 'online' | 'offline' | 'checking' | undefined =
				manualStatus?.status
			if (!status && storedStatus) {
				status = storedStatus.online ? 'online' : 'offline'
			}

			return {
				...server,
				status,
				playerCount:
					manualStatus?.playerCount ?? storedStatus?.playerCount,
				maxPlayers:
					manualStatus?.maxPlayers ?? storedStatus?.maxPlayers,
				softwareClassification:
					manualStatus?.softwareClassification ??
					storedStatus?.softwareClassification,
			}
		})
	}, [orgServers, storedStatuses, manualStatuses])

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

	const handleDeleteServer = useCallback(
		async (serverId: Id<'servers'>, serverName: string) => {
			try {
				await deleteServer({ id: serverId })
				toast.success(`${serverName} has been deleted`)
			} catch (error) {
				toast.error('Failed to delete server')
				console.error(error)
			}
		},
		[deleteServer],
	)

	const columns = useMemo<ColumnDef<ServerRow>[]>(
		() => [
			{
				id: 'name',
				accessorKey: 'name',
				header: ({
					column,
				}: {
					column: Column<ServerRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Server" />,
				cell: ({ row }) => (
					<Link
						className="flex items-center gap-3 hover:underline"
						href={`/servers/${row.original.slug}`}
					>
						{row.original.logoUrl ? (
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
						)}
						<span className="font-medium">{row.original.name}</span>
					</Link>
				),
				meta: {
					label: 'Server',
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
				cell: ({ row }) => {
					const status = row.original.status

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
						row.original.softwareClassification ===
							'geyser_likely' ||
						row.original.softwareClassification === 'ambiguous'
					) {
						return (
							<Status
								variant={
									row.original.softwareClassification ===
									'geyser_likely'
										? 'error'
										: 'warning'
								}
							>
								<StatusIndicator />
								<StatusLabel>
									{getSoftwareClassificationLabel(
										row.original.softwareClassification,
									)}
								</StatusLabel>
							</Status>
						)
					}

					return (
						<Status
							variant={status === 'online' ? 'success' : 'error'}
						>
							<StatusIndicator />
							<StatusLabel className="capitalize">
								{status}
							</StatusLabel>
						</Status>
					)
				},
				meta: {
					label: 'Status',
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
				cell: ({ row }) => (
					<div className="font-mono text-sm">
						{row.original.ipAddress}:{row.original.port || 19_132}
					</div>
				),
			},
			{
				id: 'playerCount',
				accessorKey: 'playerCount',
				header: ({
					column,
				}: {
					column: Column<ServerRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Players" />,
				cell: ({ row }) => {
					const server = row.original
					if (
						server.status !== 'online' ||
						server.playerCount === undefined
					) {
						return (
							<div className="text-muted-foreground text-sm">
								-
							</div>
						)
					}
					return (
						<div className="text-muted-foreground text-sm">
							{server.playerCount}/{server.maxPlayers}
						</div>
					)
				},
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
							server={server}
						/>
					)
				},
				size: 32,
			},
		],
		[handleDeleteServer, handleRefreshStatus],
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

	const addServerHref = organization?.id
		? `/dashboard/servers/add?org=${organization.id}`
		: '/dashboard/servers/add'

	// Loading state
	if (orgLoading || orgServers === undefined) {
		return (
			<div className="space-y-4">
				<div className="flex gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-8 w-32" />
				</div>
				<div className="rounded-md border">
					<div className="space-y-3 p-4">
						{LOADING_ROW_KEYS.map((key) => (
							<div className="flex items-center gap-4" key={key}>
								<Skeleton className="size-8 rounded" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-48" />
									<Skeleton className="h-3 w-64" />
								</div>
								<Skeleton className="h-6 w-16" />
								<Skeleton className="h-4 w-32" />
							</div>
						))}
					</div>
				</div>
			</div>
		)
	}

	// Empty state
	if (servers.length === 0) {
		return (
			<Empty className="border border-dashed py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon
							className="size-5"
							icon={ServerStack03Icon}
						/>
					</EmptyMedia>
					<EmptyTitle>No servers yet</EmptyTitle>
					<EmptyDescription>
						Add a Minecraft Bedrock server to this organization.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						nativeButton={false}
						render={(props) => (
							<Link {...props} href={addServerHref}>
								<HugeiconsIcon
									className="size-4"
									icon={Add01Icon}
								/>
								Add Server
							</Link>
						)}
					/>
				</EmptyContent>
			</Empty>
		)
	}

	return (
		<DataTable table={table}>
			<DataTableToolbar table={table}>
				<Button
					nativeButton={false}
					render={(props) => (
						<Link {...props} href={addServerHref}>
							<HugeiconsIcon
								className="size-4"
								icon={Add01Icon}
							/>
							Add Server
						</Link>
					)}
				/>
			</DataTableToolbar>
		</DataTable>
	)
}
