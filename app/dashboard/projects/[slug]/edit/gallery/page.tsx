import { ProjectGallerySettingsForm } from '@/components/user-dashboard/projects/edit/gallery-settings-form'

interface GalleryPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function GalleryPage({ params }: GalleryPageProps) {
	const { slug } = await params

	return <ProjectGallerySettingsForm slug={slug} />
}
