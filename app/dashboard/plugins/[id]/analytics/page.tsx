import type { Metadata } from 'next'
import { PluginAnalytics } from '@/components/user-dashboard/analytics/content-analytics'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

export const metadata: Metadata = {
	title: 'Analytics',
	robots: { index: false, follow: false },
}

export default async function PluginAnalyticsPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <PluginAnalytics draftId={await resolveProjectDraftId(id)} />
}
