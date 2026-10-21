import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { PluginWorkflowManager } from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Publishing workflow',
	robots: { index: false, follow: false },
}

export default async function ProjectWorkflowPage({
	params,
}: {
	params: Promise<{ draftId: string }>
}) {
	const { draftId } = await params
	const resolvedDraftId = await resolveProjectDraftId(draftId)
	return (
		<DashboardPageShell
			description="Pick the build workflow for your plugin’s server software and commit it to the repository."
			eyebrow="Plugins"
			title="Build workflow"
		>
			<PluginWorkflowManager draftId={resolvedDraftId} />
		</DashboardPageShell>
	)
}
