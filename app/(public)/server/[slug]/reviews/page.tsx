import { ServerDetailShell } from '@/components/servers/detail/server-detail-shell'
import { canonicalServer } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'

interface ServerReviewsPageProps {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}

export default async function ServerReviewsPage({
	params,
	searchParams,
}: ServerReviewsPageProps) {
	const { slug } = await params
	await canonicalServer(slug, '/reviews', (await searchParams) ?? {})

	return <ServerDetailShell activeTab="reviews" slug={slug} />
}
