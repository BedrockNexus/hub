'use client'

import { Add01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Column, ColumnDef } from '@tanstack/react-table'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { api } from '@/convex/_generated/api'
import { useDataTable } from '@/hooks/use-data-table'
import type { DataTableFeatures } from '@/lib/data-table-features'
import { formatRegistryDate } from '@/lib/plugins/format-registry'

export type WorkflowTemplate = FunctionReturnType<
	typeof api.functions.plugins.workflowTemplates.list
>[number]

type TemplateColumn = Column<DataTableFeatures, WorkflowTemplate, unknown>

export function WorkflowTemplatesTable({
	templates,
	onAdd,
	onEdit,
}: {
	templates: WorkflowTemplate[]
	onAdd: () => void
	onEdit: (template: WorkflowTemplate) => void
}) {
	const columns = useMemo<ColumnDef<DataTableFeatures, WorkflowTemplate>[]>(
		() => [
			{
				id: 'label',
				accessorKey: 'label',
				header: ({ column }: { column: TemplateColumn }) => (
					<DataTableColumnHeader
						column={column}
						label="Template name"
					/>
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.label}</span>
				),
				meta: {
					label: 'Template name',
					placeholder: 'Search templates...',
					variant: 'text',
				},
				enableColumnFilter: true,
				enableHiding: false,
				size: 280,
			},
			{
				id: 'softwareId',
				accessorKey: 'softwareId',
				header: ({ column }: { column: TemplateColumn }) => (
					<DataTableColumnHeader
						column={column}
						label="Server software"
					/>
				),
				cell: ({ row }) => row.original.softwareName,
				meta: {
					label: 'Server software',
					variant: 'multiSelect',
					options: Array.from(
						new Map(
							templates.map((template) => [
								template.softwareId,
								{
									value: template.softwareId,
									label: template.softwareName,
								},
							]),
						).values(),
					),
				},
				enableColumnFilter: true,
				enableSorting: false,
				size: 200,
			},
			{
				id: 'version',
				accessorKey: 'version',
				header: ({ column }: { column: TemplateColumn }) => (
					<DataTableColumnHeader column={column} label="Version" />
				),
				cell: ({ row }) => (
					<Badge variant="outline">v{row.original.version}</Badge>
				),
				size: 100,
			},
			{
				id: 'updatedAt',
				accessorKey: 'updatedAt',
				header: ({ column }: { column: TemplateColumn }) => (
					<DataTableColumnHeader column={column} label="Updated" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.updatedAt
							? formatRegistryDate(row.original.updatedAt)
							: 'Not recorded'}
					</span>
				),
				size: 160,
			},
			{
				id: 'actions',
				cell: ({ row }) => (
					<Button
						aria-label={`Edit ${row.original.label}`}
						onClick={() => onEdit(row.original)}
						size="icon-sm"
						variant="ghost"
					>
						<HugeiconsIcon
							className="size-4"
							icon={PencilEdit02Icon}
						/>
					</Button>
				),
			},
		],
		[templates, onEdit],
	)
	const { table } = useDataTable({
		mode: 'client',
		data: templates,
		columns,
		getRowId: (template) => template.key,
		enableMultiSort: false,
		enableRowSelection: false,
		initialState: {
			pagination: { pageIndex: 0, pageSize: 10 },
			sorting: [{ id: 'label', desc: false }],
		},
	})

	return (
		<DataTable aria-label="Workflow templates" table={table}>
			<DataTableToolbar
				className="flex-col gap-3 sm:flex-row"
				table={table}
			>
				<Button onClick={onAdd}>
					<HugeiconsIcon className="size-4" icon={Add01Icon} />
					Add workflow template
				</Button>
			</DataTableToolbar>
		</DataTable>
	)
}
