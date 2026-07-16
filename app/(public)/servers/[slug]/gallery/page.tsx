import { ServerDetailShell } from '@/components/servers/detail/server-detail-shell'

interface ServerGalleryPageProps {
	params: Promise<{ slug: string }>
}

export default async function ServerGalleryPage({
	params,
}: ServerGalleryPageProps) {
	const { slug } = await params

	return <ServerDetailShell activeTab="gallery" slug={slug} />
}
