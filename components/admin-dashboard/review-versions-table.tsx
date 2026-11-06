'use client'

import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { formatBytes } from '@/lib/plugins/format-registry'

export interface ReviewVersionRow {
	id: string
	version: string
	fileName?: string
	size?: number
	submittedAt?: number
	status: ReactNode
	/** Extra facts shown above the changelog, such as game versions or a commit. */
	facts?: [label: string, value: ReactNode][]
	/** Moderator feedback, validation errors and other notices. */
	notices?: ReactNode
	changelog: ReactNode
	/** Decisions or tools for this one version. */
	actions?: ReactNode
}

const COLUMN_COUNT = 6

/** Versions of a plugin, add-on or resource pack, one expandable row each. */
export function ReviewVersionsTable({
	rows,
	openId,
	emptyMessage,
}: {
	rows: ReviewVersionRow[]
	/** The row to expand when the table first renders. */
	openId?: string | null
	emptyMessage: string
}) {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12">
							<span className="sr-only">Changelog</span>
						</TableHead>
						<TableHead>Version</TableHead>
						<TableHead>File</TableHead>
						<TableHead>Size</TableHead>
						<TableHead>Submitted</TableHead>
						<TableHead>Status</TableHead>
					</TableRow>
				</TableHeader>
				{rows.length ? (
					rows.map((row) => (
						<ReviewVersionTableRow
							defaultOpen={row.id === openId}
							key={row.id}
							row={row}
						/>
					))
				) : (
					<TableBody>
						<TableRow>
							<TableCell
								className="h-24 text-center text-muted-foreground"
								colSpan={COLUMN_COUNT}
							>
								{emptyMessage}
							</TableCell>
						</TableRow>
					</TableBody>
				)}
			</Table>
		</div>
	)
}

function ReviewVersionTableRow({
	row,
	defaultOpen,
}: {
	row: ReviewVersionRow
	defaultOpen: boolean
}) {
	return (
		<Collapsible
			defaultOpen={defaultOpen}
			render={<TableBody className="border-b last:border-b-0" />}
		>
			<TableRow id={`release-${row.id}`}>
				<TableCell className="pl-3">
					<CollapsibleTrigger
						render={(props) => (
							<Button
								{...props}
								aria-label={`Toggle details for version ${row.version}`}
								className="data-open:rotate-180"
								size="icon-sm"
								variant="ghost"
							>
								<HugeiconsIcon
									aria-hidden
									className="size-4"
									icon={ArrowDown01Icon}
								/>
							</Button>
						)}
					/>
				</TableCell>
				<TableCell className="font-mono font-semibold">
					{row.version}
				</TableCell>
				<TableCell className="max-w-72 truncate" title={row.fileName}>
					{row.fileName ?? (
						<span className="text-muted-foreground">
							Not available yet
						</span>
					)}
				</TableCell>
				<TableCell className="text-muted-foreground tabular-nums">
					{row.size === undefined ? '-' : formatBytes(row.size)}
				</TableCell>
				<TableCell className="text-muted-foreground">
					{row.submittedAt ? formatDate(row.submittedAt) : '-'}
				</TableCell>
				<TableCell>{row.status}</TableCell>
			</TableRow>
			<CollapsibleContent
				render={<TableRow className="hover:bg-transparent" />}
			>
				<TableCell
					className="whitespace-normal bg-muted/20 p-5 sm:p-6"
					colSpan={COLUMN_COUNT}
				>
					<div className="space-y-5">
						{row.facts?.length ? (
							<dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
								{row.facts.map(([label, value]) => (
									<div className="min-w-0" key={label}>
										<dt className="text-muted-foreground">
											{label}
										</dt>
										<dd className="break-all">{value}</dd>
									</div>
								))}
							</dl>
						) : null}
						{row.notices}
						<section className="space-y-3">
							<h3 className="font-semibold text-sm">
								Changelog - {row.version}
							</h3>
							{row.changelog}
						</section>
						{row.actions ? (
							<div className="border-t pt-4">{row.actions}</div>
						) : null}
					</div>
				</TableCell>
			</CollapsibleContent>
		</Collapsible>
	)
}
