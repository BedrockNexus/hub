import type { Metadata } from 'next'

import { PluginLinksSettingsForm } from '@/components/user-dashboard/plugins/edit/links-settings-form'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Links',
	robots: { index: false, follow: false },
}

export default async function PluginLinksPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <PluginLinksSettingsForm draftId={await resolveProjectDraftId(id)} />
}
