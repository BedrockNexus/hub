import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { PluginSettingsManager } from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'General',
	robots: { index: false, follow: false },
}

export default async function PluginGeneralPage({
	params,
}: {
	params: Promise<{ draftId: string }>
}) {
	const { draftId } = await params
	const resolvedDraftId = await resolveProjectDraftId(draftId)
	return (
		<DashboardPageShell
			description="The icon, name, slug and summary of your plugin."
			eyebrow="Plugins"
			title="General"
		>
			<PluginSettingsManager
				draftId={resolvedDraftId}
				section="general"
			/>
		</DashboardPageShell>
	)
}
