import type { Metadata } from 'next'
import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { WorkflowTemplateEditPage } from '@/components/plugins/publishing/workflow-template-edit-page'
import { decodeRouteParam } from '@/lib/route-params'

export const metadata: Metadata = {
	title: 'Edit workflow template',
	robots: { index: false, follow: false },
}

export default async function Page({
	params,
}: {
	params: Promise<{ key: string }>
}) {
	// Keys contain a colon (`software:name`).
	const key = decodeRouteParam((await params).key)
	return (
		<DashboardPageShell
			description="Changes apply when a publisher installs or updates this workflow."
			title="Edit workflow template"
		>
			<WorkflowTemplateEditPage templateKey={key} />
		</DashboardPageShell>
	)
}
