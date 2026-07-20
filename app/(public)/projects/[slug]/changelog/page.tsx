import { redirect } from 'next/navigation'

interface ProjectChangelogPageProps {
	params: Promise<{ slug: string }>
}

export default async function ProjectChangelogPage({
	params,
}: ProjectChangelogPageProps) {
	const { slug } = await params

	redirect(`/projects/${slug}/releases`)
}
