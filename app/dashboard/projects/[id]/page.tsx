import { ProjectGeneralSettingsForm } from '@/components/user-dashboard/projects/edit/general-settings-form'

interface EditProjectPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function EditProjectPage({
	params,
}: EditProjectPageProps) {
	const { id } = await params

	return <ProjectGeneralSettingsForm id={id} />
}
