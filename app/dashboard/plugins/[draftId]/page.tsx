import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { DeletePluginZone } from '@/components/plugins/publishing/delete-plugin-zone'
import {
	PluginDetailsManager,
	PluginManageNav,
} from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Manage plugin',
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
			description="What people see on the plugin page."
			eyebrow="Plugins"
			title="Plugin details"
		>
			<PluginManageNav draftId={draftId} />
			<PluginDetailsManager draftId={resolvedDraftId} />
			<DeletePluginZone draftId={resolvedDraftId} />
		</DashboardPageShell>
	)
}
