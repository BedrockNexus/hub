import { BrandingSettingsForm } from '@/components/user-dashboard/servers/edit/branding-settings-form'

interface BrandingPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function BrandingPage({ params }: BrandingPageProps) {
	const { id } = await params

	return <BrandingSettingsForm id={id} />
}
