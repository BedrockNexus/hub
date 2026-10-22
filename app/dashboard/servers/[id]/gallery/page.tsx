import { GallerySettingsForm } from '@/components/user-dashboard/servers/edit/gallery-settings-form'

interface GalleryPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function GalleryPage({ params }: GalleryPageProps) {
	const { id } = await params

	return <GallerySettingsForm id={id} />
}
