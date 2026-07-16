import { ProjectDetailShell } from '@/components/projects/detail/project-detail-shell'

interface ProjectGalleryPageProps {
	params: Promise<{ slug: string }>
}

export default async function ProjectGalleryPage({
	params,
}: ProjectGalleryPageProps) {
	const { slug } = await params

	return <ProjectDetailShell activeTab="gallery" slug={slug} />
}
