import type { Metadata } from 'next'

import { PluginGallerySettingsForm } from '@/components/user-dashboard/plugins/edit/gallery-settings-form'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Gallery',
	robots: { index: false, follow: false },
}

export default async function PluginGalleryPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return (
		<PluginGallerySettingsForm draftId={await resolveProjectDraftId(id)} />
	)
}
