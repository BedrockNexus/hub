import { ServerDetailShell } from '@/components/servers/detail/server-detail-shell'

interface ServerReviewsPageProps {
	params: Promise<{ slug: string }>
}

export default async function ServerReviewsPage({
	params,
}: ServerReviewsPageProps) {
	const { slug } = await params

	return <ServerDetailShell activeTab="reviews" slug={slug} />
}
