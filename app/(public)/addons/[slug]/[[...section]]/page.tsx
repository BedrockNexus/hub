import {
	ContentPage,
	type ContentPageProps,
	contentMetadata,
} from '@/components/projects/detail/content-page'
export function generateMetadata(props: ContentPageProps) {
	return contentMetadata(props, 'addon')
}
export default function Page(props: ContentPageProps) {
	return <ContentPage {...props} type="addon" />
}
