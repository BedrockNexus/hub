import {
	ContentPage,
	type ContentPageProps,
	contentMetadata,
} from '@/components/projects/detail/content-page'
export function generateMetadata(props: ContentPageProps) {
	return contentMetadata(props, 'resource_pack')
}
export default function Page(props: ContentPageProps) {
	return <ContentPage {...props} type="resource_pack" />
}
