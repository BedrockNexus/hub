'use client'

import {
	Copy01Icon,
	MoreHorizontalIcon,
	UserBlock01Icon,
	UserCheck01Icon,
	UserGroupIcon,
	UserShield01Icon,
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
import { useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { DashboardTableSkeleton } from '@/components/user-dashboard/dashboard-table-skeleton'
import { api } from '@/convex/_generated/api'

type UserRole = 'user' | 'admin' | string
type AccountStatus = 'banned' | 'verified' | 'unverified'

const WHITESPACE_PATTERN = /\s+/

interface AdminUserRow {
	_id: string
	name: string
	displayName: string
	email: string
	emailVerified: boolean
	image?: string
	username?: string
	displayUsername?: string
	role: UserRole
	banned: boolean
	banReason?: string
	banExpires?: number
	createdAt: number
	updatedAt: number
	serverCount: number
	projectCount: number
	isCurrentUser: boolean
}

interface UserPatch {
	role?: 'user' | 'admin'
	banned?: boolean
	banReason?: string
}

function getInitials(user: AdminUserRow) {
	const source = user.displayName || user.email
	return source
		.split(WHITESPACE_PATTERN)
		.map((part) => part.charAt(0))
		.join('')
		.slice(0, 2)
		.toUpperCase()
}

function getAccountStatus(row: AdminUserRow): AccountStatus {
	if (row.banned) {
		return 'banned'
	}
	return row.emailVerified ? 'verified' : 'unverified'
}

function RoleBadge({ role }: { role: UserRole }) {
	if (role === 'admin') {
		return <Badge variant="secondary">Admin</Badge>
	}

	if (role === 'user') {
		return <Badge variant="outline">User</Badge>
	}

	return role ? (
		<Badge variant="outline">{role}</Badge>
	) : (
		<Badge variant="outline">User</Badge>
	)
}

function AccountStatusBadge({ user }: { user: AdminUserRow }) {
	if (user.banned) {
		return (
			<Status variant="error">
				<StatusLabel>Banned</StatusLabel>
			</Status>
		)
	}

	if (!user.emailVerified) {
		return (
			<Status variant="warning">
				<StatusLabel>Unverified</StatusLabel>
			</Status>
		)
	}

	return (
		<Status variant="success">
			<StatusLabel>Verified</StatusLabel>
		</Status>
	)
}

function AdminUsersStats({ users }: { users: AdminUserRow[] }) {
	const adminCount = users.filter((user) => user.role === 'admin').length
	const bannedCount = users.filter((user) => user.banned).length
	const unverifiedCount = users.filter((user) => !user.emailVerified).length
	const verifiedCount = users.filter((user) => user.emailVerified).length

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Stat>
				<StatLabel>Total Users</StatLabel>
				<StatValue>{users.length}</StatValue>
				<StatDescription>{verifiedCount} verified</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Admins</StatLabel>
				<StatValue>{adminCount}</StatValue>
				<StatDescription>Accounts with admin access</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Unverified</StatLabel>
				<StatValue>{unverifiedCount}</StatValue>
				<StatDescription>Need email verification</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Banned</StatLabel>
				<StatValue>{bannedCount}</StatValue>
				<StatDescription>Blocked accounts</StatDescription>
			</Stat>
		</div>
	)
}

function UserActionsCell({
	user,
	onPatch,
}: {
	user: AdminUserRow
	onPatch: (
		user: AdminUserRow,
		patch: UserPatch,
		message: string,
	) => Promise<void>
}) {
	const [isUpdating, setIsUpdating] = useState(false)
	const [pendingCommand, setPendingCommand] = useState<{
		label: string
		message: string
		patch: UserPatch
		title: string
	} | null>(null)

	const runPatch = async (patch: UserPatch, message: string) => {
		setIsUpdating(true)
		try {
			await onPatch(user, patch, message)
		} finally {
			setIsUpdating(false)
		}
	}

	const copyId = async () => {
		try {
			await navigator.clipboard.writeText(user._id)
			toast.success('User ID copied')
		} catch {
			toast.error('Failed to copy user ID')
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={(props) => (
						<Button
							{...props}
							disabled={isUpdating}
							size="icon"
							variant="ghost"
						>
							{isUpdating ? (
								<Spinner className="size-4" />
							) : (
								<HugeiconsIcon
									className="size-4"
									icon={MoreHorizontalIcon}
								/>
							)}
							<span className="sr-only">Open menu</span>
						</Button>
					)}
				/>
				<DropdownMenuContent align="end" className="w-48">
					{user.username ? (
						<DropdownMenuItem
							nativeButton={false}
							render={(props) => (
								<Link
									{...props}
									href={`/user/${user.username}`}
								/>
							)}
						>
							<HugeiconsIcon className="size-4" icon={ViewIcon} />
							View Public Profile
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem onClick={copyId}>
						<HugeiconsIcon className="size-4" icon={Copy01Icon} />
						Copy User ID
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={isUpdating || user.role === 'admin'}
						onClick={() =>
							setPendingCommand({
								label: 'Promote Admin',
								message: `${user.displayName} is now an admin`,
								patch: { role: 'admin' },
								title: `Promote ${user.displayName} to admin?`,
							})
						}
					>
						<HugeiconsIcon
							className="size-4"
							icon={UserShield01Icon}
						/>
						Promote Admin
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={
							isUpdating ||
							user.role !== 'admin' ||
							user.isCurrentUser
						}
						onClick={() =>
							setPendingCommand({
								label: 'Make User',
								message: `${user.displayName} is now a user`,
								patch: { role: 'user' },
								title: `Remove admin access from ${user.displayName}?`,
							})
						}
					>
						<HugeiconsIcon
							className="size-4"
							icon={UserCheck01Icon}
						/>
						Make User
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={isUpdating || user.isCurrentUser}
						onClick={() =>
							setPendingCommand({
								label: user.banned ? 'Unban' : 'Ban',
								message: user.banned
									? `${user.displayName} unbanned`
									: `${user.displayName} banned`,
								patch: {
									banned: !user.banned,
									banReason: user.banned
										? undefined
										: 'Admin action',
								},
								title: user.banned
									? `Unban ${user.displayName}?`
									: `Ban ${user.displayName}?`,
							})
						}
						variant={user.banned ? 'default' : 'destructive'}
					>
						<HugeiconsIcon
							className="size-4"
							icon={UserBlock01Icon}
						/>
						{user.banned ? 'Unban' : 'Ban'}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog
				onOpenChange={(open) => !open && setPendingCommand(null)}
				open={!!pendingCommand}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{pendingCommand?.title}
						</AlertDialogTitle>
						<AlertDialogDescription>
							This changes account access immediately. Confirm
							that you intend to apply this action.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isUpdating}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={isUpdating}
							onClick={async () => {
								if (!pendingCommand) {
									return
								}
								await runPatch(
									pendingCommand.patch,
									pendingCommand.message,
								)
								setPendingCommand(null)
							}}
							variant={
								pendingCommand?.patch.banned
									? 'destructive'
									: 'default'
							}
						>
							{isUpdating ? <Spinner className="size-4" /> : null}
							{pendingCommand?.label}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export function AdminUsersTable() {
	const adminUsers = useQuery(api.functions.site.users.listAdmin, {
		limit: 250,
	})
	const updateUser = useMutation(api.functions.site.users.updateAdminUser)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

	const users = useMemo(
		() => (adminUsers ?? []) as AdminUserRow[],
		[adminUsers],
	)

	const handlePatch = useCallback(
		async (user: AdminUserRow, patch: UserPatch, message: string) => {
			try {
				await updateUser({ userId: user._id, ...patch })
				toast.success(message)
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: 'Failed to update user',
				)
			}
		},
		[updateUser],
	)

	const columns = useMemo<ColumnDef<AdminUserRow>[]>(
		() => [
			{
				id: 'user',
				accessorFn: (row) =>
					`${row.displayName} ${row.email} ${row.username ?? ''}`,
				header: ({
					column,
				}: {
					column: Column<AdminUserRow, unknown>
				}) => <DataTableColumnHeader column={column} label="User" />,
				cell: ({ row }) => (
					<div className="flex min-w-64 items-center gap-3">
						<Avatar className="size-9">
							<AvatarImage
								alt={row.original.displayName}
								src={row.original.image}
							/>
							<AvatarFallback>
								{getInitials(row.original)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<div className="truncate font-medium">
								{row.original.displayName}
							</div>
							<div className="truncate text-muted-foreground text-xs">
								{row.original.email}
							</div>
						</div>
					</div>
				),
				meta: {
					label: 'User',
					placeholder: 'Search users...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'username',
				accessorKey: 'username',
				header: ({
					column,
				}: {
					column: Column<AdminUserRow, unknown>
				}) => (
					<DataTableColumnHeader column={column} label="Username" />
				),
				cell: ({ row }) =>
					row.original.username ? (
						<span className="font-mono text-muted-foreground text-sm">
							@{row.original.username}
						</span>
					) : (
						<span className="text-muted-foreground text-sm">-</span>
					),
			},
			{
				id: 'role',
				accessorKey: 'role',
				header: ({
					column,
				}: {
					column: Column<AdminUserRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Role" />,
				cell: ({ row }) => <RoleBadge role={row.original.role} />,
				meta: {
					label: 'Role',
					variant: 'multiSelect',
					options: [
						{ label: 'Admin', value: 'admin' },
						{ label: 'User', value: 'user' },
					],
				},
				enableColumnFilter: true,
			},
			{
				id: 'accountStatus',
				accessorFn: getAccountStatus,
				header: ({
					column,
				}: {
					column: Column<AdminUserRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Status" />,
				cell: ({ row }) => <AccountStatusBadge user={row.original} />,
				meta: {
					label: 'Status',
					variant: 'multiSelect',
					options: [
						{ label: 'Verified', value: 'verified' },
						{ label: 'Unverified', value: 'unverified' },
						{ label: 'Banned', value: 'banned' },
					],
				},
				enableColumnFilter: true,
			},
			{
				id: 'content',
				header: 'Content',
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-1">
						<Badge variant="outline">
							{row.original.serverCount} servers
						</Badge>
						<Badge variant="outline">
							{row.original.projectCount} projects
						</Badge>
					</div>
				),
			},
			{
				id: 'joined',
				accessorKey: 'createdAt',
				header: ({
					column,
				}: {
					column: Column<AdminUserRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Joined" />,
				cell: ({ row }) => (
					<div className="text-muted-foreground text-sm">
						{new Date(row.original.createdAt).toLocaleDateString()}
					</div>
				),
			},
			{
				id: 'actions',
				cell: ({ row }) => (
					<UserActionsCell
						onPatch={handlePatch}
						user={row.original}
					/>
				),
				size: 32,
			},
		],
		[handlePatch],
	)

	const table = useReactTable({
		data: users,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		onColumnFiltersChange: setColumnFilters,
		state: { columnFilters },
		initialState: { pagination: { pageSize: 10 } },
	})

	if (adminUsers === undefined) {
		return <DashboardTableSkeleton />
	}

	if (users.length === 0) {
		return (
			<div className="space-y-6">
				<AdminPageHeader
					description="Search accounts, inspect content ownership, and manage access state."
					title="Users"
				/>
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<HugeiconsIcon
								className="size-7"
								icon={UserGroupIcon}
							/>
						</div>
						<div>
							<h2 className="font-semibold text-lg">
								No users found
							</h2>
							<p className="text-muted-foreground text-sm">
								Accounts will appear here after registration.
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
				description="Search accounts, inspect content ownership, and manage access state."
				title="Users"
			/>
			<AdminUsersStats users={users} />
			<DataTable table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
