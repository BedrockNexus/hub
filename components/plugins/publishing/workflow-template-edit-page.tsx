'use client'

import { useConvexAuth, useQuery } from 'convex/react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { SettingsSkeleton } from '@/components/user-dashboard/settings-section'
import { api } from '@/convex/_generated/api'
import {
	WORKFLOW_REPOSITORY_URL,
	workflowSourceUrl,
} from '@/lib/plugins/workflow-catalog'

export function WorkflowTemplateEditPage({
	templateKey,
}: {
	templateKey: string
}) {
	const auth = useConvexAuth()
	const templates = useQuery(
		api.functions.plugins.workflowTemplates.list,
		auth.isAuthenticated ? {} : 'skip',
	)
	const template = templates?.find((item) => item.key === templateKey)
	const source =
		template?.sourceCommit && template.sourcePath
			? workflowSourceUrl(template.sourceCommit, template.sourcePath)
			: WORKFLOW_REPOSITORY_URL
	return (
		<div className="min-w-0 space-y-5">
			<Link
				className={buttonVariants({ variant: 'outline' })}
				href="/admin/plugins/workflows"
			>
				Back to workflow templates
			</Link>
			{auth.isLoading || templates === undefined ? (
				<SettingsSkeleton />
			) : template ? (
				<>
					<h2 className="font-semibold text-lg">{template.label}</h2>
					<p className="text-muted-foreground text-sm">
						This template is maintained in the official repository.
						Submit changes there, then refresh the catalog.
					</p>
					<a
						className={buttonVariants({ variant: 'outline' })}
						href={source}
						rel="noopener noreferrer"
						target="_blank"
					>
						View template on GitHub
					</a>
					<pre className="max-h-[36rem] overflow-auto rounded-md border p-4 text-sm">
						<code>{template.content}</code>
					</pre>
				</>
			) : (
				<p className="text-muted-foreground">
					Workflow template not found.
				</p>
			)}
		</div>
	)
}
