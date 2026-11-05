'use client'

import { GithubIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation } from 'convex/react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import { Badge } from '@/components/ui/badge'
import {
	ListingPublicationBadge,
	ListingReviewBadge,
} from '@/components/user-dashboard/listing-review-state'
import { ListingRowActions } from '@/components/user-dashboard/listing-row-actions'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useDataTable } from '@/hooks/use-data-table'
import {
	type CreatorListingInput,
	creatorListingState,
	PUBLICATION_LABELS,
	REVIEW_LABELS,
} from '@/lib/creator-listing-state'
import type { DataTableFeatures } from '@/lib/data-table-features'
import { formatRegistryDate } from '@/lib/plugins/format-registry'

export interface PluginListRow extends CreatorListingInput {
	listingId: string
	draftId?: Id<'pluginPublishingDrafts'>
	slug: string
	key: string
	name: string
	dashboardKey: string | null
	repository: { fullName: string; htmlUrl: string } | null
	version: string | null
	updatedAt: number
	manageHref: string | null
	publicHref: string | null
}

export function PluginListTable({ rows }: { rows: PluginListRow[] }) {
	const router = useRouter()
	const deletePlugin = useMutation(
		api.functions.plugins.deletion.deleteProject,
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
				accessorFn: (row) => creatorListingState(row).publication,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} label="Status" />
				),
				cell: ({ row }) => (
					<ListingPublicationBadge
						status={creatorListingState(row.original).publication}
					/>
				),
				meta: {
					label: 'Status',
					variant: 'select',
					options: Object.entries(PUBLICATION_LABELS).map(
						([value, label]) => ({ value, label }),
					),
				},
				enableColumnFilter: true,
			},
			{
				id: 'review',
				accessorFn: (row) => creatorListingState(row).review,
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						label="Review status"
					/>
				),
				cell: ({ row }) => (
					<ListingReviewBadge
						status={creatorListingState(row.original).review}
					/>
				),
				meta: {
					label: 'Review status',
					variant: 'multiSelect',
					options: Object.entries(REVIEW_LABELS).map(
						([value, label]) => ({ value, label }),
					),
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
				cell: ({ row }) => {
					const plugin = row.original
					const draftId = plugin.draftId
					return (
						<ListingRowActions
							deletion={
								!creatorListingState(plugin).locked && draftId
									? {
											name: plugin.name,
											confirmText: plugin.slug,
											description:
												'This permanently deletes the plugin, its versions, files, reviews and gallery. Recorded submission history and its images are retained. Your GitHub repository is unchanged.',
											onDelete: async (confirmation) => {
												await deletePlugin({
													draftId,
													confirmSlug: confirmation,
												})
												router.refresh()
											},
										}
									: undefined
							}
							editHref={plugin.manageHref}
							id={plugin.listingId}
							name={plugin.name}
							publicHref={plugin.publicHref}
							repositoryHref={plugin.repository?.htmlUrl}
							reviewHref={
								plugin.manageHref
									? `${plugin.manageHref}/review`
									: undefined
							}
						/>
					)
				},
				enableSorting: false,
				enableHiding: false,
				size: 32,
			},
		],
		[deletePlugin, router],
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
