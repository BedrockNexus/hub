import type { Metadata } from 'next'

import { PluginWorkflowManager } from '@/components/plugins/publishing/publishing-wizard'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Workflow',
	robots: { index: false, follow: false },
}

export default async function PluginWorkflowPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <PluginWorkflowManager draftId={await resolveProjectDraftId(id)} />
}
