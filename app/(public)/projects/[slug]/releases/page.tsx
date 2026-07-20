import { ProjectDetailShell } from '@/components/projects/detail/project-detail-shell'

export default async function ProjectReleasesPage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	return <ProjectDetailShell activeTab="releases" slug={slug} />
}
