import { ConnectionSettingsForm } from '@/components/user-dashboard/servers/edit/connection-settings-form'

interface ConnectionPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function ConnectionPage({ params }: ConnectionPageProps) {
	const { id } = await params

	return <ConnectionSettingsForm id={id} />
}
