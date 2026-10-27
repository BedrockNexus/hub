import {
	ContentSettingsPage,
	type ContentSettingsProps,
} from '@/components/user-dashboard/projects/content-settings-page'
export default function Page(props: ContentSettingsProps) {
	return <ContentSettingsPage {...props} type="addon" />
}
