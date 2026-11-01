import { PluginDetailShell } from '@/components/plugins/detail/plugin-detail-shell'
import { canonicalPlugin } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'

export default async function PluginReviewsPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}) {
	const { slug } = await params
	await canonicalPlugin(slug, '/reviews', (await searchParams) ?? {})
	return <PluginDetailShell activeTab="reviews" slug={slug} />
}
