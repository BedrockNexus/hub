import { ProjectLinksSettingsForm } from '@/components/user-dashboard/projects/edit/links-settings-form'

interface LinksPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function LinksPage({ params }: LinksPageProps) {
	const { slug } = await params

	return <ProjectLinksSettingsForm slug={slug} />
}
