import { BrandingSettingsForm } from '@/components/user-dashboard/servers/edit/branding-settings-form'
import { canonicalServerSettings } from '@/lib/canonical-content'

interface BrandingPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function BrandingPage({ params }: BrandingPageProps) {
	const { id } = await params
	await canonicalServerSettings(id, '/branding')

	return <BrandingSettingsForm id={id} />
}
