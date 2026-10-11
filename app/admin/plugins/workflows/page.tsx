import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { WorkflowTemplateEditor } from '@/components/plugins/publishing/workflow-template-editor'

export const metadata: Metadata = {
	title: 'Workflow templates',
	robots: { index: false, follow: false },
}

export default function WorkflowTemplatesPage() {
	return (
		<DashboardPageShell
			description="Add and manage the validated GitHub Actions workflows publishers can select."
			eyebrow="Publishing infrastructure"
			title="Workflow templates"
		>
			<WorkflowTemplateEditor />
		</DashboardPageShell>
	)
}
