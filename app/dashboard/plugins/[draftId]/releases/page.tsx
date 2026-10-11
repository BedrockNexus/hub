import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import {
	ProjectManageNav,
	ProjectReleaseManager,
} from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Project releases',
	robots: { index: false, follow: false },
}

export default async function ProjectReleasesPage({
	params,
}: {
	params: Promise<{ draftId: string }>
}) {
	const { draftId } = await params
	const resolvedDraftId = await resolveProjectDraftId(draftId)
	return (
		<DashboardPageShell
			description="Detect verified GitHub releases, choose one, and submit it for moderator review."
			eyebrow="Projects"
			title="Releases and review"
		>
			<ProjectManageNav draftId={draftId} />
			<ProjectReleaseManager draftId={resolvedDraftId} />
		</DashboardPageShell>
	)
}
