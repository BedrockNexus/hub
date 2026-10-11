import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { DeleteProjectZone } from '@/components/plugins/publishing/delete-project-zone'
import {
	ProjectManageNav,
	ProjectMetadataManager,
} from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Manage project',
	robots: { index: false, follow: false },
}

export default async function ManageProjectPage({
	params,
}: {
	params: Promise<{ draftId: string }>
}) {
	const { draftId } = await params
	const resolvedDraftId = await resolveProjectDraftId(draftId)
	return (
		<DashboardPageShell
			description="Manage the catalog information for this plugin. Repository setup stays in Add Project."
			eyebrow="Projects"
			title="Project metadata"
		>
			<ProjectManageNav draftId={draftId} />
			<ProjectMetadataManager draftId={resolvedDraftId} />
			<DeleteProjectZone draftId={resolvedDraftId} />
		</DashboardPageShell>
	)
}
