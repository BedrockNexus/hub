import { LinksSettingsForm } from '@/components/user-dashboard/servers/edit/links-settings-form'

interface LinksPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function LinksPage({ params }: LinksPageProps) {
	const { id } = await params

	return <LinksSettingsForm id={id} />
}
