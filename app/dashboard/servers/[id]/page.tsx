import { GeneralSettingsForm } from '@/components/user-dashboard/servers/edit/general-settings-form'

interface EditServerPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function EditServerPage({ params }: EditServerPageProps) {
	const { id } = await params

	return <GeneralSettingsForm id={id} />
}
