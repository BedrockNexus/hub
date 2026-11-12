'use client'

import {
	Copy01Icon,
	LinkSquare02Icon,
	MoreHorizontalIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import type { Route } from 'next'
import Link from 'next/link'
import { type ReactNode, useMemo } from 'react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin-dashboard/admin-page-header'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import {
	Status,
	StatusIndicator,
	StatusLabel,
} from '@/components/dice-ui/status'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DashboardTableSkeleton } from '@/components/user-dashboard/dashboard-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { useMinute } from '@/hooks/use-minute'
import {
	CONTENT_STATUS_LABELS,
	CONTENT_STATUSES,
	type ContentStatus,
	type ContentStatusKey,
} from '@/lib/content-status'
import type { DataTableFeatures } from '@/lib/data-table-features'
import { formatDate } from '@/lib/format'
import { waitingTime } from '@/lib/moderation-time'
import { cn } from '@/lib/utils'
import { ReviewIcon } from './review/review-layout'

/** One addon, resource pack or plugin, as every moderation table shows it. */
export interface ContentTableRow {
	id: string
	name: string
	/** "by owner", or "owner · software" for plugins. */
	subtitle: string
	iconUrl?: string
	status: ContentStatus
	version?: string
	downloads: number
	updatedAt: number
	reviewHref: string
	publicHref?: string
}

const NEEDS_REVIEW = 'needs_review'

const STATUS_VARIANTS: Record<
	ContentStatusKey,
	'success' | 'warning' | 'error' | 'default'
> = {
	live: 'success',
	awaiting_review: 'warning',
	changes_requested: 'default',
	draft: 'default',
	unpublished: 'default',
	flagged: 'error',
	rejected: 'error',
	archived: 'default',
}

function StatusCell({ status }: { status: ContentStatus }) {
	const now = useMinute()
	const waited =
		status.needsReview && status.waitingSince
			? ` · ${waitingTime(now - status.waitingSince)}`
			: ''
	return (
		<div className="flex flex-col items-start gap-1">
			<Status variant={STATUS_VARIANTS[status.key]}>
				{status.key === 'live' ? <StatusIndicator /> : null}
				<StatusLabel>{status.label}</StatusLabel>
			</Status>
			{status.note || waited ? (
				<span
					className={cn(
						'text-xs',
						status.needsReview
							? 'font-semibold text-primary'
							: 'text-muted-foreground',
					)}
				>
					{status.note ?? 'Waiting'}
					{waited}
				</span>
			) : null}
		</div>
	)
}

/** Review when something waits for a moderator, Open otherwise. */
function OpenCell({ row }: { row: ContentTableRow }) {
	return (
		<div className="flex justify-end">
			<Link
				className={cn(
					buttonVariants({ variant: 'outline' }),
					row.status.needsReview && 'border-primary/40 text-primary',
				)}
				href={row.reviewHref as Route}
			>
				{row.status.needsReview ? 'Review' : 'Open'}
			</Link>
		</div>
	)
}

function ActionsCell({
	row,
	singular,
}: {
	row: ContentTableRow
	singular: string
}) {
	const copyId = async () => {
		try {
			await navigator.clipboard.writeText(row.id)
			toast.success(`${singular} ID copied`)
		} catch {
			toast.error('Could not copy the ID')
		}
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={(props) => (
					<Button
						{...props}
						aria-label={`More actions for ${row.name}`}
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
				{row.publicHref ? (
					<DropdownMenuItem
						nativeButton={false}
						render={(props) => (
							<Link
								{...props}
								href={row.publicHref as Route}
								target="_blank"
							/>
						)}
					>
						<HugeiconsIcon
							aria-hidden
							className="size-4"
							icon={LinkSquare02Icon}
						/>
						Open public page
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem onClick={copyId}>
					<HugeiconsIcon
						aria-hidden
						className="size-4"
						icon={Copy01Icon}
					/>
					Copy {singular.toLowerCase()} ID
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function Tile({
	label,
	value,
	warn = false,
}: {
	label: string
	value: number
	warn?: boolean
}) {
	return (
		<div
			className={cn(
				'flex flex-col gap-1 rounded-lg border bg-card px-4.5 py-4',
				warn && 'border-primary/40 bg-primary/5',
			)}
		>
			<span
				className={cn(
					'text-[13px] text-muted-foreground',
					warn && 'text-primary',
				)}
			>
				{label}
			</span>
			<span
				className={cn(
					'font-bold font-display text-[1.6rem] leading-none',
					warn && 'text-primary',
				)}
			>
				{value}
			</span>
		</div>
	)
}

/**
 * Every addon, resource pack or plugin on the site, with one status that
 * says where each stands. All three use this table, so they read the same.
 */
export function AdminContentTable({
	title,
	singular,
	rows,
	empty,
}: {
	/** Plural, such as "Addons". */
	title: string
	/** Such as "Addon". */
	singular: string
	rows: ContentTableRow[] | undefined
	/** Shown when there is nothing yet. */
	empty?: ReactNode
}) {
	const data = useMemo(() => rows ?? [], [rows])
	const columns = useMemo<ColumnDef<DataTableFeatures, ContentTableRow>[]>(
		() => [
			{
				id: 'name',
				accessorFn: (row) => `${row.name} ${row.subtitle}`,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label={singular} />
				),
				cell: ({ row }) => (
					<div className="flex min-w-0 items-center gap-3">
						<ReviewIcon
							name={row.original.name}
							size={38}
							src={row.original.iconUrl}
						/>
						<div className="flex min-w-0 flex-col gap-0.5">
							<Link
								className="truncate font-semibold hover:text-primary"
								href={row.original.reviewHref as Route}
							>
								{row.original.name}
							</Link>
							<span className="truncate text-[13px] text-muted-foreground">
								{row.original.subtitle}
							</span>
						</div>
					</div>
				),
				size: 280,
				meta: {
					label: singular,
					placeholder: 'Search by name or creator...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'status',
				accessorFn: (row) => row.status.key,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Status" />
				),
				cell: ({ row }) => <StatusCell status={row.original.status} />,
				size: 200,
				meta: {
					label: 'Status',
					variant: 'multiSelect',
					options: [
						{ value: NEEDS_REVIEW, label: 'Needs review' },
						...CONTENT_STATUSES.map((key) => ({
							value: key,
							label: CONTENT_STATUS_LABELS[key],
						})),
					],
				},
				enableColumnFilter: true,
				filterFn: (row, _id, values: string[]) =>
					!values.length ||
					values.includes(row.original.status.key) ||
					(values.includes(NEEDS_REVIEW) &&
						row.original.status.needsReview),
			},
			{
				id: 'version',
				accessorFn: (row) => row.version ?? '',
				header: 'Version',
				cell: ({ row }) => (
					<span className="font-mono text-[13px] text-muted-foreground">
						{row.original.version ?? '—'}
					</span>
				),
				enableSorting: false,
				size: 90,
			},
			{
				id: 'downloads',
				accessorKey: 'downloads',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Downloads" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums">
						{row.original.downloads.toLocaleString()}
					</span>
				),
				size: 100,
			},
			{
				id: 'updatedAt',
				accessorKey: 'updatedAt',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Updated" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{formatDate(row.original.updatedAt, { month: 'short' })}
					</span>
				),
				size: 120,
			},
			{
				id: 'open',
				header: () => <span className="sr-only">Open</span>,
				cell: ({ row }) => <OpenCell row={row.original} />,
				enableHiding: false,
				enableSorting: false,
				size: 100,
			},
			{
				id: 'actions',
				cell: ({ row }) => (
					<ActionsCell row={row.original} singular={singular} />
				),
			},
		],
		[singular],
	)
	const { table } = useDataTable({
		mode: 'client',
		data,
		columns,
		getRowId: (row) => row.id,
		initialState: {
			sorting: [{ id: 'updatedAt', desc: true }],
			pagination: { pageIndex: 0, pageSize: 20 },
		},
	})

	const header = (
		<AdminPageHeader
			description={`Every ${singular.toLowerCase()} on the site. One status says where each one stands.`}
			title={title}
		/>
	)
	if (rows === undefined) {
		return (
			<div className="min-w-0 space-y-6">
				{header}
				<DashboardTableSkeleton />
			</div>
		)
	}
	if (!rows.length && empty) {
		return (
			<div className="min-w-0 space-y-6">
				{header}
				{empty}
			</div>
		)
	}
	return (
		<div className="min-w-0 space-y-6">
			{header}
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<Tile label="All" value={rows.length} />
				<Tile
					label="Live"
					value={
						rows.filter((row) => row.status.key === 'live').length
					}
				/>
				<Tile
					label="Needs review"
					value={rows.filter((row) => row.status.needsReview).length}
					warn
				/>
				<Tile
					label="Flagged or rejected"
					value={
						rows.filter(
							(row) =>
								row.status.key === 'flagged' ||
								row.status.key === 'rejected',
						).length
					}
				/>
			</div>
			<DataTable aria-label={title} table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
		</div>
	)
}
