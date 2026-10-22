import { ProjectLinksSettingsForm } from '@/components/user-dashboard/projects/edit/links-settings-form'

interface LinksPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function LinksPage({ params }: LinksPageProps) {
	const { id } = await params

	return <ProjectLinksSettingsForm id={id} />
}
