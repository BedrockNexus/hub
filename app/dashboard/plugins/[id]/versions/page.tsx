import type { Metadata } from 'next'

import { PluginBuildsManager } from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Versions',
	robots: { index: false, follow: false },
}

export default async function PluginVersionsPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <PluginBuildsManager draftId={await resolveProjectDraftId(id)} />
}
