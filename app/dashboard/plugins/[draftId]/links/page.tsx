import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { PluginLinksManager } from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Links',
	robots: { index: false, follow: false },
}

export default async function PluginLinksPage({
	params,
}: {
	params: Promise<{ draftId: string }>
}) {
	const { draftId } = await params
	const resolvedDraftId = await resolveProjectDraftId(draftId)
	return (
		<DashboardPageShell
			description="Issue tracker, wiki, Discord, website and donation links."
			eyebrow="Plugins"
			title="Links"
		>
			<PluginLinksManager draftId={resolvedDraftId} />
		</DashboardPageShell>
	)
}
