import { GallerySettingsForm } from '@/components/user-dashboard/servers/edit/gallery-settings-form'

interface GalleryPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function GalleryPage({ params }: GalleryPageProps) {
	const { slug } = await params

	return <GallerySettingsForm slug={slug} />
}
