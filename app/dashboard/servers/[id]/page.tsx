import { GeneralSettingsForm } from '@/components/user-dashboard/servers/edit/general-settings-form'
import { canonicalServerSettings } from '@/lib/canonical-content'

interface EditServerPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function EditServerPage({ params }: EditServerPageProps) {
	const { id } = await params
	await canonicalServerSettings(id, '')

	return <GeneralSettingsForm id={id} />
}
