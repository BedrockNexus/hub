import { AddProjectForm } from '@/components/user-dashboard/projects/add-project-form'
import { requireMapsUi } from '@/lib/maps-route'
export default function Page() {
	requireMapsUi()
	return <AddProjectForm key="maps" type="map" />
}
