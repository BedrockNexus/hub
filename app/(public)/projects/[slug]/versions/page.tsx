import { redirect } from 'next/navigation'

interface ProjectVersionsPageProps {
	params: Promise<{ slug: string }>
}

export default async function ProjectVersionsPage({
	params,
}: ProjectVersionsPageProps) {
	const { slug } = await params

	redirect(`/projects/${slug}/releases`)
}
