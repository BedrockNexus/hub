import { AddProjectForm } from '@/components/user-dashboard/projects/add-project-form'
import { getSiteFeatures } from '@/lib/site-settings'

export default async function Page() {
	const features = await getSiteFeatures()
	return (
		<AddProjectForm
			key="resource-packs"
			showPlugins={features.pluginsEnabled}
			type="resource_pack"
		/>
	)
}
