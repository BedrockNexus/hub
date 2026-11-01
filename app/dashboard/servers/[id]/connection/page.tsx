import { ConnectionSettingsForm } from '@/components/user-dashboard/servers/edit/connection-settings-form'
import { canonicalServerSettings } from '@/lib/canonical-content'

interface ConnectionPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function ConnectionPage({ params }: ConnectionPageProps) {
	const { id } = await params
	await canonicalServerSettings(id, '/connection')

	return <ConnectionSettingsForm id={id} />
}
