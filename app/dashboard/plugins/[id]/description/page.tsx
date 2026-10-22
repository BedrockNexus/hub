import type { Metadata } from 'next'

import { PluginDescriptionSettingsForm } from '@/components/user-dashboard/plugins/edit/description-settings-form'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Description',
	robots: { index: false, follow: false },
}

export default async function PluginDescriptionPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return (
		<PluginDescriptionSettingsForm
			draftId={await resolveProjectDraftId(id)}
		/>
	)
}
