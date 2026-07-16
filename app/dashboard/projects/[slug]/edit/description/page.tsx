import { ProjectDescriptionSettingsForm } from '@/components/user-dashboard/projects/edit/description-settings-form'

interface DescriptionPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function DescriptionPage({
	params,
}: DescriptionPageProps) {
	const { slug } = await params

	return <ProjectDescriptionSettingsForm slug={slug} />
}
