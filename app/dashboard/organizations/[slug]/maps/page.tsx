import { OrganizationContentManager } from '@/components/user-dashboard/projects/organization-content-manager'
import { requireMapsUi } from '@/lib/maps-route'
export default function Page() {
	requireMapsUi()
	return <OrganizationContentManager type="map" />
}
