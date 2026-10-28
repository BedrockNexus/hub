import { ContentManager } from '@/components/user-dashboard/projects/content-manager'
import { requireMapsUi } from '@/lib/maps-route'
export default function Page() {
	requireMapsUi()
	return <ContentManager type="map" />
}
