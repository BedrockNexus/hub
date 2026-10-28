import {
	ContentSettingsPage,
	type ContentSettingsProps,
} from '@/components/user-dashboard/projects/content-settings-page'
import { requireMapsUi } from '@/lib/maps-route'
export default function Page(props: ContentSettingsProps) {
	requireMapsUi()
	return <ContentSettingsPage {...props} type="map" />
}
