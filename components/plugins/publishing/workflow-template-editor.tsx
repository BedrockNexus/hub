'use client'

import { useAction, useConvexAuth, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton'
import { WorkflowTemplatesTable } from '@/components/plugins/publishing/workflow-templates-table'
import { Button, buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { formatRegistryDate } from '@/lib/plugins/format-registry'
import { WORKFLOW_REPOSITORY_URL } from '@/lib/plugins/workflow-catalog'
import { userFacingError } from '@/lib/user-facing-error'

export function WorkflowTemplateEditor() {
	const auth = useConvexAuth()
	const templates = useQuery(
		api.functions.plugins.workflowTemplates.list,
		auth.isAuthenticated ? {} : 'skip',
	)
	const status = useQuery(
		api.functions.plugins.workflowTemplates.status,
		auth.isAuthenticated ? {} : 'skip',
	)
	const refresh = useAction(api.functions.plugins.workflowCatalog.refresh)
	const [busy, setBusy] = useState(false)
	if (auth.isLoading || templates === undefined || status === undefined) {
		return (
			<DataTableSkeleton columnCount={5} filterCount={2} rowCount={5} />
		)
	}
	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">
					Templates update from the official repository every 15
					minutes. Propose changes on GitHub.
				</p>
				<div className="flex flex-wrap gap-2">
					<a
						className={buttonVariants({ variant: 'outline' })}
						href={WORKFLOW_REPOSITORY_URL}
						rel="noopener noreferrer"
						target="_blank"
					>
						Open repository
					</a>
					<Button
						disabled={busy}
						onClick={async () => {
							setBusy(true)
							try {
								const result = await refresh({})
								toast.success(
									result
										? `Catalog refreshed: ${result.updated} updated, ${result.retired} retired.`
										: 'A refresh was started recently. Please try again in a minute.',
								)
							} catch (error) {
								toast.error(
									userFacingError(
										error,
										'The catalog could not be refreshed.',
									),
								)
							} finally {
								setBusy(false)
							}
						}}
					>
						{busy ? 'Refreshing...' : 'Refresh catalog'}
					</Button>
				</div>
			</div>
			<p className="text-muted-foreground text-sm">
				{status?.lastSyncedAt
					? `Last refreshed ${formatRegistryDate(status.lastSyncedAt)} · ${status.sourceCommit?.slice(0, 7)}`
					: 'Waiting for the first repository refresh. Existing templates remain available.'}
			</p>
			{status?.lastError ? (
				<p className="text-destructive text-sm" role="status">
					{status.lastError} The last successful catalog is still
					available.
				</p>
			) : null}
			<WorkflowTemplatesTable templates={templates} />
		</div>
	)
}
