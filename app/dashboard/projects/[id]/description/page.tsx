import { ProjectDescriptionSettingsForm } from '@/components/user-dashboard/projects/edit/description-settings-form'

interface DescriptionPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function DescriptionPage({
	params,
}: DescriptionPageProps) {
	const { id } = await params

	return <ProjectDescriptionSettingsForm id={id} />
}
