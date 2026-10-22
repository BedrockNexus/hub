import type { Metadata } from 'next'

import { PluginGeneralSettingsForm } from '@/components/user-dashboard/plugins/edit/general-settings-form'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'General',
	robots: { index: false, follow: false },
}

export default async function PluginGeneralPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return (
		<PluginGeneralSettingsForm draftId={await resolveProjectDraftId(id)} />
	)
}
