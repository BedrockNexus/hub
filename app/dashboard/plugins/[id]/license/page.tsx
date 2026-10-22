import type { Metadata } from 'next'

import { PluginLicenseSettingsForm } from '@/components/user-dashboard/plugins/edit/license-settings-form'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'License',
	robots: { index: false, follow: false },
}

export default async function PluginLicensePage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return (
		<PluginLicenseSettingsForm draftId={await resolveProjectDraftId(id)} />
	)
}
