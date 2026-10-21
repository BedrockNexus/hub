import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { PluginBuildsManager } from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Builds and versions',
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
			description="Every push builds your plugin. Pick a build, give it a version, and send it to moderator review."
			eyebrow="Plugins"
			title="Builds and versions"
		>
			<PluginBuildsManager draftId={resolvedDraftId} />
		</DashboardPageShell>
	)
}
