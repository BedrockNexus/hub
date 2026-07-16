import { ProjectGeneralSettingsForm } from '@/components/user-dashboard/projects/edit/general-settings-form'

interface EditProjectPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function EditProjectPage({
	params,
}: EditProjectPageProps) {
	const { slug } = await params

	return <ProjectGeneralSettingsForm slug={slug} />
}
