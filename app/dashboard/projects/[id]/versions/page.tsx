import { notFound } from 'next/navigation'
import { ProjectVersionsForm } from '@/components/user-dashboard/projects/edit/versions-settings-form'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'

interface VersionsPageProps {
	params: Promise<{ id: string }>
}

export default async function VersionsPage({ params }: VersionsPageProps) {
	const { id } = await params
	const project = await fetchAuthQuery(
		api.functions.projects.projects.getForEdit,
		{ id },
	)

	if (!project) {
		notFound()
	}

	return <ProjectVersionsForm projectId={project._id} />
}
