import { ProjectDetailShell } from '@/components/projects/detail/project-detail-shell'

interface ProjectReviewsPageProps {
	params: Promise<{ slug: string }>
}

export default async function ProjectReviewsPage({
	params,
}: ProjectReviewsPageProps) {
	const { slug } = await params

	return <ProjectDetailShell activeTab="reviews" slug={slug} />
}
