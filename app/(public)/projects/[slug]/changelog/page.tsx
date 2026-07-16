import { ProjectDetailShell } from '@/components/projects/detail/project-detail-shell'

interface ProjectChangelogPageProps {
	params: Promise<{ slug: string }>
}

export default async function ProjectChangelogPage({
	params,
}: ProjectChangelogPageProps) {
	const { slug } = await params

	return <ProjectDetailShell activeTab="changelog" slug={slug} />
}
