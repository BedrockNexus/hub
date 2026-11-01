import { PluginDetailShell } from '@/components/plugins/detail/plugin-detail-shell'
import { canonicalPlugin } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'

export default async function PluginGalleryPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}) {
	const { slug } = await params
	await canonicalPlugin(slug, '/gallery', (await searchParams) ?? {})
	return <PluginDetailShell activeTab="gallery" slug={slug} />
}
