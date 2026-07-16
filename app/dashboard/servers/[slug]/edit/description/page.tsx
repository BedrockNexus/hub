import { ServerDescriptionSettingsForm } from '@/components/user-dashboard/servers/edit/description-settings-form'

interface DescriptionPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function DescriptionPage({
	params,
}: DescriptionPageProps) {
	const { slug } = await params

	return <ServerDescriptionSettingsForm slug={slug} />
}
