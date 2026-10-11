import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import {
	ProjectManageNav,
	ProjectWorkflowManager,
} from '@/components/plugins/publishing/publishing-wizard'
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
			description="Install or update the admin-managed GitHub Actions workflow on the repository."
			eyebrow="Projects"
			title="Publishing workflow"
		>
			<ProjectManageNav draftId={draftId} />
			<ProjectWorkflowManager draftId={resolvedDraftId} />
		</DashboardPageShell>
	)
}
