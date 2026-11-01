import { GallerySettingsForm } from '@/components/user-dashboard/servers/edit/gallery-settings-form'
import { canonicalServerSettings } from '@/lib/canonical-content'

interface GalleryPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function GalleryPage({ params }: GalleryPageProps) {
	const { id } = await params
	await canonicalServerSettings(id, '/gallery')

	return <GallerySettingsForm id={id} />
}
