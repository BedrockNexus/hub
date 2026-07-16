import { notFound } from 'next/navigation'
import { AddVersionForm } from '@/components/user-dashboard/projects/versions/add-version-form'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'

interface AddVersionPageProps {
	params: Promise<{ slug: string }>
}

export default async function AddVersionPage({ params }: AddVersionPageProps) {
	const { slug } = await params
	const project = await fetchAuthQuery(
		api.functions.projects.projects.getBySlug,
		{ slug },
	)

	if (!project) {
		notFound()
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">Publish New Version</h2>
				<p className="text-muted-foreground text-sm">
					Upload a new release for{' '}
					<span className="font-medium text-foreground">
						{project.name}
					</span>
				</p>
			</div>

			<AddVersionForm projectId={project._id} projectSlug={slug} />
		</div>
	)
}
