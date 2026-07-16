'use client'

import {
	Copy01Icon,
	Link01Icon,
	MoreHorizontalIcon,
	OfficeIcon,
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
import { useMemo, useState } from 'react'
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
import { DashboardTableSkeleton } from '@/components/user-dashboard/dashboard-table-skeleton'
import { api } from '@/convex/_generated/api'

type OrganizationRiskStatus =
	| 'healthy'
	| 'pending_invites'
	| 'expired_invites'
	| 'missing_owner'

const WHITESPACE_PATTERN = /\s+/

interface AdminOrganizationRow {
	_id: string
	name: string
	slug: string
	logo?: string
	createdAt: number
	memberCount: number
	ownerCount: number
	adminCount: number
	ownerName: string
	pendingInvitationCount: number
	expiredInvitationCount: number
	serverCount: number
	projectCount: number
	riskStatus: OrganizationRiskStatus
}

function getInitials(name: string) {
	return name
		.split(WHITESPACE_PATTERN)
		.map((part) => part.charAt(0))
		.join('')
		.slice(0, 2)
		.toUpperCase()
}

function RiskStatusBadge({ status }: { status: OrganizationRiskStatus }) {
	if (status === 'missing_owner') {
		return (
			<Status variant="error">
				<StatusLabel>Missing Owner</StatusLabel>
			</Status>
		)
	}

	if (status === 'expired_invites') {
		return (
			<Status variant="warning">
				<StatusLabel>Expired Invites</StatusLabel>
			</Status>
		)
	}

	if (status === 'pending_invites') {
		return (
			<Status variant="info">
				<StatusLabel>Pending Invites</StatusLabel>
			</Status>
		)
	}

	return (
		<Status variant="success">
			<StatusLabel>Healthy</StatusLabel>
		</Status>
	)
}

function AdminOrganizationsStats({
	organizations,
}: {
	organizations: AdminOrganizationRow[]
}) {
	const memberCount = organizations.reduce(
		(sum, organization) => sum + organization.memberCount,
		0,
	)
	const pendingInvitationCount = organizations.reduce(
		(sum, organization) => sum + organization.pendingInvitationCount,
		0,
	)
	const missingOwnerCount = organizations.filter(
		(organization) => organization.ownerCount === 0,
	).length
	const ownedContentCount = organizations.reduce(
		(sum, organization) =>
			sum + organization.serverCount + organization.projectCount,
		0,
	)

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Stat>
				<StatLabel>Organizations</StatLabel>
				<StatValue>{organizations.length}</StatValue>
				<StatDescription>{memberCount} total members</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Pending Invites</StatLabel>
				<StatValue>{pendingInvitationCount}</StatValue>
				<StatDescription>Across all organizations</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Ownership Risks</StatLabel>
				<StatValue>{missingOwnerCount}</StatValue>
				<StatDescription>Organizations without owners</StatDescription>
			</Stat>
			<Stat>
				<StatLabel>Owned Content</StatLabel>
				<StatValue>{ownedContentCount}</StatValue>
				<StatDescription>Servers and projects</StatDescription>
			</Stat>
		</div>
	)
}

function OrganizationActionsCell({
	organization,
}: {
	organization: AdminOrganizationRow
}) {
	const copy = async (value: string, label: string) => {
		try {
			await navigator.clipboard.writeText(value)
			toast.success(`${label} copied`)
		} catch {
			toast.error(`Failed to copy ${label.toLowerCase()}`)
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
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuItem
					onClick={() => copy(organization._id, 'Organization ID')}
				>
					<HugeiconsIcon className="size-4" icon={Copy01Icon} />
					Copy Org ID
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => copy(organization.slug, 'Slug')}
				>
					<HugeiconsIcon className="size-4" icon={Link01Icon} />
					Copy Slug
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function AdminOrganizationsTable() {
	const adminOrganizations = useQuery(
		api.functions.site.organizations.listAdmin,
		{},
	)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const organizations = useMemo(
		() => (adminOrganizations ?? []) as AdminOrganizationRow[],
		[adminOrganizations],
	)

	const columns = useMemo<ColumnDef<AdminOrganizationRow>[]>(
		() => [
			{
				id: 'organization',
				accessorFn: (row) => `${row.name} ${row.slug}`,
				header: ({
					column,
				}: {
					column: Column<AdminOrganizationRow, unknown>
				}) => (
					<DataTableColumnHeader
						column={column}
						label="Organization"
					/>
				),
				cell: ({ row }) => (
					<div className="flex min-w-64 items-center gap-3">
						<Avatar className="size-9 rounded-lg">
							<AvatarImage
								alt={row.original.name}
								src={row.original.logo}
							/>
							<AvatarFallback className="rounded-lg">
								{getInitials(row.original.name)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<div className="truncate font-medium">
								{row.original.name}
							</div>
							<div className="truncate font-mono text-muted-foreground text-xs">
								/{row.original.slug}
							</div>
						</div>
					</div>
				),
				meta: {
					label: 'Organization',
					placeholder: 'Search organizations...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'riskStatus',
				accessorKey: 'riskStatus',
				header: ({
					column,
				}: {
					column: Column<AdminOrganizationRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Status" />,
				cell: ({ row }) => (
					<RiskStatusBadge status={row.original.riskStatus} />
				),
				meta: {
					label: 'Status',
					variant: 'multiSelect',
					options: [
						{ label: 'Healthy', value: 'healthy' },
						{ label: 'Pending Invites', value: 'pending_invites' },
						{ label: 'Expired Invites', value: 'expired_invites' },
						{ label: 'Missing Owner', value: 'missing_owner' },
					],
				},
				enableColumnFilter: true,
			},
			{
				id: 'owner',
				accessorKey: 'ownerName',
				header: ({
					column,
				}: {
					column: Column<AdminOrganizationRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Owner" />,
				cell: ({ row }) => (
					<div className="min-w-40 text-sm">
						<div>{row.original.ownerName}</div>
						<div className="text-muted-foreground text-xs">
							{row.original.ownerCount} owners
						</div>
					</div>
				),
			},
			{
				id: 'members',
				accessorKey: 'memberCount',
				header: ({
					column,
				}: {
					column: Column<AdminOrganizationRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Members" />,
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-1">
						<Badge variant="outline">
							{row.original.memberCount} members
						</Badge>
						<Badge variant="outline">
							{row.original.adminCount} admins
						</Badge>
					</div>
				),
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
				id: 'invitations',
				header: 'Invitations',
				cell: ({ row }) => (
					<div className="min-w-32 text-sm">
						<div>{row.original.pendingInvitationCount} pending</div>
						<div className="text-muted-foreground text-xs">
							{row.original.expiredInvitationCount} expired
						</div>
					</div>
				),
			},
			{
				id: 'createdAt',
				accessorKey: 'createdAt',
				header: ({
					column,
				}: {
					column: Column<AdminOrganizationRow, unknown>
				}) => <DataTableColumnHeader column={column} label="Created" />,
				cell: ({ row }) => (
					<div className="text-muted-foreground text-sm">
						{new Date(row.original.createdAt).toLocaleDateString()}
					</div>
				),
			},
			{
				id: 'actions',
				cell: ({ row }) => (
					<OrganizationActionsCell organization={row.original} />
				),
				size: 32,
			},
		],
		[],
	)

	const table = useReactTable({
		data: organizations,
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

	if (adminOrganizations === undefined) {
		return <DashboardTableSkeleton />
	}

	if (organizations.length === 0) {
		return (
			<div className="space-y-6">
				<AdminPageHeader
					description="Review organization ownership, memberships, invitations, and owned content."
					title="Organizations"
				/>
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<HugeiconsIcon
								className="size-7"
								icon={OfficeIcon}
							/>
						</div>
						<div>
							<h2 className="font-semibold text-lg">
								No organizations found
							</h2>
							<p className="text-muted-foreground text-sm">
								Organizations will appear here after users
								create them.
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
				description="Review organization ownership, memberships, invitations, and owned content."
				title="Organizations"
			/>
			<AdminOrganizationsStats organizations={organizations} />
			<DataTable table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
