import { ServerDescriptionSettingsForm } from '@/components/user-dashboard/servers/edit/description-settings-form'

interface DescriptionPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function DescriptionPage({
	params,
}: DescriptionPageProps) {
	const { id } = await params

	return <ServerDescriptionSettingsForm id={id} />
}
