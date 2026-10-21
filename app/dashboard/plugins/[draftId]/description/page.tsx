import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { PluginSettingsManager } from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Description',
	robots: { index: false, follow: false },
}

export default async function PluginDescriptionPage({
	params,
}: {
	params: Promise<{ draftId: string }>
}) {
	const { draftId } = await params
	const resolvedDraftId = await resolveProjectDraftId(draftId)
	return (
		<DashboardPageShell
			description="The long description on your plugin page."
			eyebrow="Plugins"
			title="Description"
		>
			<PluginSettingsManager
				draftId={resolvedDraftId}
				section="description"
			/>
		</DashboardPageShell>
	)
}
