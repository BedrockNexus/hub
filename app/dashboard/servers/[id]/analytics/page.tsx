import type { Metadata } from 'next'
import { ServerAnalytics } from '@/components/user-dashboard/analytics/content-analytics'
import { canonicalServerSettings } from '@/lib/canonical-content'

export const metadata: Metadata = {
	title: 'Analytics',
	robots: { index: false, follow: false },
}

export default async function ServerAnalyticsPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const server = await canonicalServerSettings(id, '/analytics')
	return (
		<ServerAnalytics
			isPublic={server.status === 'published'}
			serverId={server._id}
		/>
	)
}
