import { ServerDescriptionSettingsForm } from '@/components/user-dashboard/servers/edit/description-settings-form'
import { canonicalServerSettings } from '@/lib/canonical-content'

interface DescriptionPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function DescriptionPage({
	params,
}: DescriptionPageProps) {
	const { id } = await params
	await canonicalServerSettings(id, '/description')

	return <ServerDescriptionSettingsForm id={id} />
}
