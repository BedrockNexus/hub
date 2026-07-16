import { ProjectLicenseSettingsForm } from '@/components/user-dashboard/projects/edit/license-settings-form'

interface LicensePageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function LicensePage({ params }: LicensePageProps) {
	const { slug } = await params

	return <ProjectLicenseSettingsForm slug={slug} />
}
