import { ProjectDetailShell } from '@/components/projects/detail/project-detail-shell'

interface ProjectVersionsPageProps {
	params: Promise<{ slug: string }>
}

export default async function ProjectVersionsPage({
	params,
}: ProjectVersionsPageProps) {
	const { slug } = await params

	return <ProjectDetailShell activeTab="versions" slug={slug} />
}
