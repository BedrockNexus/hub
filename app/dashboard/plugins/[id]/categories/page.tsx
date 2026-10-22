import type { Metadata } from 'next'

import { PluginCategoriesSettingsForm } from '@/components/user-dashboard/plugins/edit/categories-settings-form'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Categories',
	robots: { index: false, follow: false },
}

export default async function PluginCategoriesPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return (
		<PluginCategoriesSettingsForm
			draftId={await resolveProjectDraftId(id)}
		/>
	)
}
