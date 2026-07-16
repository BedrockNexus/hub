import { ConnectionSettingsForm } from '@/components/user-dashboard/servers/edit/connection-settings-form'

interface ConnectionPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function ConnectionPage({ params }: ConnectionPageProps) {
	const { slug } = await params

	return <ConnectionSettingsForm slug={slug} />
}
