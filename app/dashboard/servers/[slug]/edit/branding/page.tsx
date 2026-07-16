import { BrandingSettingsForm } from '@/components/user-dashboard/servers/edit/branding-settings-form'

interface BrandingPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function BrandingPage({ params }: BrandingPageProps) {
	const { slug } = await params

	return <BrandingSettingsForm slug={slug} />
}
