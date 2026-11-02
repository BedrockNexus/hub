import type { Metadata } from 'next'
import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { WorkflowTemplateEditPage } from '@/components/plugins/publishing/workflow-template-edit-page'
import { decodeRouteParam } from '@/lib/route-params'

export const metadata: Metadata = {
	title: 'View workflow template',
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
			description="Review the template and its source in the official repository."
			title="View workflow template"
		>
			<WorkflowTemplateEditPage templateKey={key} />
		</DashboardPageShell>
	)
}
