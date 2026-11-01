import { ServerDetailShell } from '@/components/servers/detail/server-detail-shell'
import { canonicalServer } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'

interface ServerGalleryPageProps {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}

export default async function ServerGalleryPage({
	params,
	searchParams,
}: ServerGalleryPageProps) {
	const { slug } = await params
	await canonicalServer(slug, '/gallery', (await searchParams) ?? {})

	return <ServerDetailShell activeTab="gallery" slug={slug} />
}
