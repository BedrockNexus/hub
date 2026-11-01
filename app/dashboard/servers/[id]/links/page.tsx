import { LinksSettingsForm } from '@/components/user-dashboard/servers/edit/links-settings-form'
import { canonicalServerSettings } from '@/lib/canonical-content'

interface LinksPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function LinksPage({ params }: LinksPageProps) {
	const { id } = await params
	await canonicalServerSettings(id, '/links')

	return <LinksSettingsForm id={id} />
}
