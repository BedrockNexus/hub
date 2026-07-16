import { LinksSettingsForm } from '@/components/user-dashboard/servers/edit/links-settings-form'

interface LinksPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function LinksPage({ params }: LinksPageProps) {
	const { slug } = await params

	return <LinksSettingsForm slug={slug} />
}
