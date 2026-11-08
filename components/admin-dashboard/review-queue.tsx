'use client'

import { MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { moderationReviewHref } from '@/lib/admin-review-navigation'
import type { DataTableFeatures } from '@/lib/data-table-features'
import { formatDate } from '@/lib/format'
import { userFacingError } from '@/lib/user-facing-error'
import type { ReviewContentId } from './review-assignment'

type Submission = FunctionReturnType<
	typeof api.functions.moderation.work.queue
>['rows'][number]
const TYPES: Record<string, string> = {
	server: 'Server',
	plugin: 'Plugin',
	addon: 'Addon',
	resource_pack: 'Resource pack',
	texture_pack: 'Resource pack',
}
function reviewHref(row: Submission) {
	const kind = (
		{ project: 'projects', server: 'servers', plugin: 'plugins' } as const
	)[row.type]
	return moderationReviewHref(kind, row.projectId ?? row.id, {
		projectType: row.packType,
		releaseId: row.version ? row.id : undefined,
	})
}
function waitingTime(milliseconds: number) {
	const minutes = Math.max(0, Math.floor(milliseconds / 60_000))
	if (minutes < 60) {
		return `${minutes}m`
	}
	if (minutes < 1440) {
		return `${Math.floor(minutes / 60)}h`
	}
	return `${Math.floor(minutes / 1440)}d`
}
function assignmentLabel(row: Submission) {
	if (row.mine) {
		return 'Mine'
	}
	return row.assignee ? 'Assigned' : 'Unassigned'
}
function QueueActions({ submission }: { submission: Submission }) {
	const claim = useMutation(api.functions.moderation.work.claim)
	const [busy, setBusy] = useState(false)
	async function changeAssignment() {
		setBusy(true)
		try {
			await claim({
				contentId: submission.id as ReviewContentId,
				revision: submission.revision,
				release: submission.mine,
			})
			toast.success(
				submission.mine ? 'Review released' : 'Review assigned to you',
			)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update assignment'))
		} finally {
			setBusy(false)
		}
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={`Actions for ${submission.name}`}
						size="icon"
						variant="ghost"
					>
						<HugeiconsIcon
							className="size-4"
							icon={MoreHorizontalIcon}
						/>
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					nativeButton={false}
					render={<Link href={reviewHref(submission)} />}
				>
					Review submission
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={
						busy || Boolean(submission.assignee && !submission.mine)
					}
					onClick={changeAssignment}
				>
					{submission.mine ? 'Release review' : 'Claim review'}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
export function ReviewQueue() {
	const data = useQuery(api.functions.moderation.work.queue, {})
	const rows = useMemo(() => data?.rows ?? [], [data])
	const [clock, setClock] = useState(() => Date.now())
	useEffect(() => {
		const timer = setInterval(() => setClock(Date.now()), 60_000)
		return () => clearInterval(timer)
	}, [])
	const columns = useMemo<ColumnDef<DataTableFeatures, Submission>[]>(
		() => [
			{
				id: 'name',
				size: 300,
				accessorFn: (row) =>
					`${row.name}${row.version ? ` v${row.version}` : ''}`,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Submission" />
				),
				cell: ({ row }) => (
					<div className="space-y-1">
						<Link
							className="block truncate font-medium hover:underline"
							href={reviewHref(row.original)}
							title={row.original.name}
						>
							{row.original.name}
						</Link>
						<p className="text-muted-foreground text-xs">
							{row.original.version
								? `Version ${row.original.version}`
								: 'Listing submission'}
						</p>
					</div>
				),
				meta: {
					label: 'Submission',
					placeholder: 'Search submissions...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'type',
				size: 130,
				accessorFn: (row) =>
					TYPES[row.packType ?? row.type] ?? row.type,
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						label="Content type"
					/>
				),
				cell: ({ getValue }) => (
					<Badge variant="outline">{String(getValue())}</Badge>
				),
				meta: {
					label: 'Content type',
					variant: 'multiSelect',
					options: ['Server', 'Plugin', 'Addon', 'Resource pack'].map(
						(label) => ({ label, value: label }),
					),
				},
				enableColumnFilter: true,
				filterFn: (row, id, values: string[]) =>
					!values.length || values.includes(row.getValue(id)),
			},
			{
				id: 'submittedAt',
				size: 150,
				accessorKey: 'submittedAt',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Submitted" />
				),
				cell: ({ row }) => (
					<time
						className="text-muted-foreground"
						dateTime={new Date(
							row.original.submittedAt,
						).toISOString()}
					>
						{formatDate(row.original.submittedAt)}
					</time>
				),
			},
			{
				id: 'waiting',
				size: 90,
				accessorFn: (row) => clock - row.submittedAt,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Waiting" />
				),
				cell: ({ getValue }) => (
					<span className="tabular-nums">
						{waitingTime(Number(getValue()))}
					</span>
				),
				meta: {
					label: 'Waiting time',
					variant: 'multiSelect',
					options: [{ label: 'Over 24 hours', value: 'over24' }],
				},
				enableColumnFilter: true,
				filterFn: (row, id, values: string[]) =>
					!values.length || Number(row.getValue(id)) >= 86_400_000,
			},
			{
				id: 'reviewer',
				size: 160,
				accessorFn: assignmentLabel,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Reviewer" />
				),
				cell: ({ row }) => (
					<span
						className={
							row.original.assignee ? '' : 'text-muted-foreground'
						}
					>
						{row.original.assignee ?? 'Unassigned'}
					</span>
				),
				meta: {
					label: 'Assignment',
					variant: 'multiSelect',
					options: ['Mine', 'Unassigned', 'Assigned'].map(
						(value) => ({
							label:
								value === 'Mine'
									? 'Assigned to me'
									: value.replace(
											'Assigned',
											'Assigned to others',
										),
							value,
						}),
					),
				},
				enableColumnFilter: true,
				filterFn: (row, id, values: string[]) =>
					!values.length || values.includes(row.getValue(id)),
			},
			{
				id: 'actions',
				cell: ({ row }) => <QueueActions submission={row.original} />,
				size: 48,
				enableHiding: false,
			},
		],
		[clock],
	)
	const { table } = useDataTable({
		mode: 'client',
		data: rows,
		columns,
		getRowId: (row) => row.id,
		initialState: {
			sorting: [{ id: 'submittedAt', desc: false }],
			pagination: { pageIndex: 0, pageSize: 20 },
		},
	})
	if (!data) {
		return <DashboardTableSkeleton />
	}
	return (
		<div className="min-w-0 space-y-5">
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
				<span>
					<strong className="font-medium text-foreground">
						{rows.length}
						{data.more ? '+' : ''}
					</strong>{' '}
					waiting
				</span>
				<span>
					<strong className="font-medium text-foreground">
						{rows.filter((row) => !row.assignee).length}
					</strong>{' '}
					unassigned
				</span>
				<span>
					<strong className="font-medium text-foreground">
						{rows.filter((row) => row.mine).length}
					</strong>{' '}
					assigned to you
				</span>
			</div>
			<DataTable aria-label="Awaiting review submissions" table={table}>
				<DataTableToolbar table={table} />
			</DataTable>
			{data.more ? (
				<p className="text-muted-foreground text-xs">
					More submissions are waiting beyond the loaded results.
					Oldest submissions are shown first.
				</p>
			) : null}
		</div>
	)
}
