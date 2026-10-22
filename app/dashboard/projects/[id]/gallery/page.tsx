import { ProjectGallerySettingsForm } from '@/components/user-dashboard/projects/edit/gallery-settings-form'

interface GalleryPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function GalleryPage({ params }: GalleryPageProps) {
	const { id } = await params

	return <ProjectGallerySettingsForm id={id} />
}
