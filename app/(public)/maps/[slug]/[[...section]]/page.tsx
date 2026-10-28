import {
	ContentPage,
	type ContentPageProps,
	contentMetadata,
} from '@/components/projects/detail/content-page'
import { requireMapsUi } from '@/lib/maps-route'
export function generateMetadata(props: ContentPageProps) {
	requireMapsUi()
	return contentMetadata(props, 'map')
}
export default function Page(props: ContentPageProps) {
	requireMapsUi()
	return <ContentPage {...props} type="map" />
}
