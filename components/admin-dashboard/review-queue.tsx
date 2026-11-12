'use client'

import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { useDataTable } from '@/hooks/use-data-table'
import { useMinute } from '@/hooks/use-minute'
import type { DataTableFeatures } from '@/lib/data-table-features'
import { queueRowHref } from '@/lib/moderation-queue'
import { OVERDUE_AFTER, waitingTime } from '@/lib/moderation-time'
import { formatBytes } from '@/lib/plugins/format-registry'
import { userFacingError } from '@/lib/user-facing-error'
import { cn } from '@/lib/utils'
import { ReviewIcon } from './review/review-layout'
import type { ReviewContentId } from './review/review-rail'

type Submission = FunctionReturnType<
	typeof api.functions.moderation.work.queue
>['rows'][number]

type ContentKind = 'server' | 'addon' | 'pack' | 'plugin'
type ReviewKind = 'new' | 'update' | 'version'
type ReviewerState = 'mine' | 'unclaimed' | 'others'

const TYPE_LABELS: Record<ContentKind, string> = {
	server: 'Server',
	addon: 'Addon',
	pack: 'Resource pack',
	plugin: 'Plugin',
}

const REVIEW_LABELS: Record<ReviewKind, string> = {
	new: 'New listing',
	update: 'Listing update',
	version: 'New version',
}

function kindOf(row: Submission): ContentKind {
	if (row.type !== 'project') {
		return row.type
	}
	return row.packType === 'resource_pack' || row.packType === 'texture_pack'
		? 'pack'
		: 'addon'
}

function reviewKindOf(row: Submission): ReviewKind {
	if (row.version) {
		return 'version'
	}
	return row.isUpdate ? 'update' : 'new'
}

function reviewerOf(row: Submission): ReviewerState {
	if (row.mine) {
		return 'mine'
	}
	return row.assignee ? 'others' : 'unclaimed'
}

/** What the moderator is asked to look at. */
function ReviewKindCell({ row }: { row: Submission }) {
	const kind = reviewKindOf(row)
	let label = REVIEW_LABELS[kind]
	let detail = row.isUpdate ? 'Changes to a live listing' : 'First submission'
	if (kind === 'version') {
		label = `Version ${row.version}`
		detail = row.fileSize ? formatBytes(row.fileSize) : 'New file'
	}
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<span
				className={cn(
					'font-semibold text-sm',
					kind === 'version' && 'text-primary',
					kind === 'new' && 'text-sky-400',
				)}
			>
				{label}
			</span>
			<span className="truncate text-[13px] text-muted-foreground">
				{detail}
			</span>
		</div>
	)
}

function useClaim() {
	const claim = useMutation(api.functions.moderation.work.claim)
	return async (row: Submission, release = false) => {
		await claim({
			contentId: row.id as ReviewContentId,
			revision: row.revision,
			release,
		})
	}
}

function ReviewerCell({ row }: { row: Submission }) {
	const claim = useClaim()
	const [busy, setBusy] = useState(false)
	const toggle = async () => {
		setBusy(true)
		try {
			await claim(row, row.mine)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update the claim'))
		} finally {
			setBusy(false)
		}
	}
	if (row.assignee && !row.mine) {
		return (
			<span className="truncate text-[13px] text-muted-foreground">
				{row.assignee}
			</span>
		)
	}
	return (
		<div className="flex items-center gap-2">
			{row.mine ? (
				<span className="flex items-center gap-1.5 font-semibold text-[13px] text-primary">
					<span
						aria-hidden
						className="size-2 rounded-full bg-primary"
					/>
					You
				</span>
			) : null}
			<Button
				aria-label={`${row.mine ? 'Release' : 'Claim'} ${row.name}`}
				disabled={busy}
				onClick={toggle}
				variant="outline"
			>
				{row.mine ? 'Release' : 'Claim'}
			</Button>
		</div>
	)
}

function WaitingCell({ waited }: { waited: number }) {
	return (
		<span
			className={cn(
				'font-mono text-[13px]',
				waited >= OVERDUE_AFTER
					? 'rounded-full bg-primary/15 px-2.5 py-0.5 font-semibold text-primary'
					: 'text-muted-foreground',
			)}
		>
			{waitingTime(waited)}
		</span>
	)
}

function Stat({
	label,
	value,
	warn = false,
}: {
	label: string
	value: number | string
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

/** Claims the oldest unclaimed submission and opens it. */
function StartNextReview({ rows }: { rows: Submission[] }) {
	const claim = useClaim()
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	const next =
		rows.find((row) => !row.assignee) ?? rows.find((row) => row.mine)
	return (
		<Button
			className="h-11 px-5"
			disabled={!next || busy}
			onClick={async () => {
				if (!next) {
					return
				}
				setBusy(true)
				try {
					if (!next.mine) {
						await claim(next)
					}
				} catch {
					// Someone else took it a moment ago; open it anyway.
				}
				router.push(queueRowHref(next) as Route)
			}}
		>
			{next ? 'Start next review' : 'Nothing to review'}
			{next ? (
				<HugeiconsIcon aria-hidden icon={ArrowRight02Icon} />
			) : null}
		</Button>
	)
}

const includes = (values: string[], value: string) =>
	!values.length || values.includes(value)

function useQueueColumns(now: number) {
	return useMemo<ColumnDef<DataTableFeatures, Submission>[]>(
		() => [
			{
				id: 'name',
				accessorFn: (row) => `${row.name} ${row.owner ?? ''}`,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Submission" />
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
								href={queueRowHref(row.original) as Route}
							>
								{row.original.name}
							</Link>
							<span className="text-[13px] text-muted-foreground">
								{TYPE_LABELS[kindOf(row.original)]}
							</span>
						</div>
					</div>
				),
				size: 260,
				meta: {
					label: 'Submission',
					placeholder: 'Search by name or creator...',
					variant: 'text',
				},
				enableColumnFilter: true,
			},
			{
				id: 'type',
				accessorFn: kindOf,
				header: 'Type',
				cell: ({ getValue }) => TYPE_LABELS[getValue() as ContentKind],
				meta: {
					label: 'Type',
					variant: 'multiSelect',
					options: (Object.keys(TYPE_LABELS) as ContentKind[]).map(
						(value) => ({ value, label: TYPE_LABELS[value] }),
					),
				},
				enableColumnFilter: true,
				filterFn: (row, id, values: string[]) =>
					includes(values, row.getValue(id)),
			},
			{
				id: 'review',
				accessorFn: reviewKindOf,
				header: 'What to review',
				cell: ({ row }) => <ReviewKindCell row={row.original} />,
				size: 200,
				enableSorting: false,
				meta: {
					label: 'What to review',
					variant: 'multiSelect',
					options: (Object.keys(REVIEW_LABELS) as ReviewKind[]).map(
						(value) => ({ value, label: REVIEW_LABELS[value] }),
					),
				},
				enableColumnFilter: true,
				filterFn: (row, id, values: string[]) =>
					includes(values, row.getValue(id)),
			},
			{
				id: 'owner',
				accessorFn: (row) => row.owner ?? '',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Creator" />
				),
				cell: ({ row }) => (
					<span className="truncate text-muted-foreground text-sm">
						{row.original.owner ?? 'Unknown'}
					</span>
				),
			},
			{
				id: 'waiting',
				accessorFn: (row) => now - row.submittedAt,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Waiting" />
				),
				cell: ({ getValue }) => (
					<WaitingCell waited={Number(getValue())} />
				),
				size: 110,
				meta: {
					label: 'Waiting',
					variant: 'multiSelect',
					options: [{ value: 'overdue', label: 'Over a day' }],
				},
				enableColumnFilter: true,
				filterFn: (row, id, values: string[]) =>
					!values.length || Number(row.getValue(id)) >= OVERDUE_AFTER,
			},
			{
				id: 'reviewer',
				accessorFn: reviewerOf,
				header: 'Reviewer',
				cell: ({ row }) => <ReviewerCell row={row.original} />,
				size: 170,
				enableSorting: false,
				meta: {
					label: 'Reviewer',
					variant: 'multiSelect',
					options: [
						{ value: 'mine', label: 'Claimed by you' },
						{ value: 'unclaimed', label: 'Unclaimed' },
						{ value: 'others', label: 'Claimed by others' },
					],
				},
				enableColumnFilter: true,
				filterFn: (row, id, values: string[]) =>
					includes(values, row.getValue(id)),
			},
			{
				id: 'open',
				header: () => <span className="sr-only">Review</span>,
				cell: ({ row }) => (
					<div className="flex justify-end">
						<Link
							className={buttonVariants({ variant: 'outline' })}
							href={queueRowHref(row.original) as Route}
						>
							Review
						</Link>
					</div>
				),
				enableHiding: false,
				enableSorting: false,
				size: 100,
			},
		],
		[now],
	)
}

export function ReviewQueue() {
	const data = useQuery(api.functions.moderation.work.queue, {})
	const now = useMinute()
	const rows = useMemo(() => data?.rows ?? [], [data])
	const columns = useQueueColumns(now)
	const { table } = useDataTable({
		mode: 'client',
		data: rows,
		columns,
		getRowId: (row) => row.id,
		initialState: {
			// Oldest first: the longest wait is the next to review.
			sorting: [{ id: 'waiting', desc: true }],
			pagination: { pageIndex: 0, pageSize: 20 },
			columnVisibility: { type: false },
		},
	})

	if (!data) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-14 w-80" />
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<Skeleton className="h-22 rounded-lg" />
					<Skeleton className="h-22 rounded-lg" />
					<Skeleton className="h-22 rounded-lg" />
					<Skeleton className="h-22 rounded-lg" />
				</div>
				<Skeleton className="h-96 rounded-lg" />
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="space-y-1.5">
					<h1 className="font-bold font-display text-3xl">
						Review queue
					</h1>
					<p className="text-muted-foreground">
						Oldest first. A claim keeps a review for you for 30
						minutes.
					</p>
				</div>
				<StartNextReview rows={rows} />
			</div>

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat
					label="Waiting"
					value={`${rows.length}${data.more ? '+' : ''}`}
				/>
				<Stat
					label="Waiting over a day"
					value={
						rows.filter(
							(row) => now - row.submittedAt >= OVERDUE_AFTER,
						).length
					}
					warn
				/>
				<Stat
					label="Unclaimed"
					value={rows.filter((row) => !row.assignee).length}
				/>
				<Stat
					label="Claimed by you"
					value={rows.filter((row) => row.mine).length}
				/>
			</div>

			<DataTable
				aria-label="Submissions waiting for review"
				table={table}
			>
				<DataTableToolbar table={table} />
			</DataTable>
			{data.more ? (
				<p className="text-muted-foreground text-xs">
					More submissions are waiting beyond the loaded results. The
					oldest are shown first.
				</p>
			) : null}
		</div>
	)
}
