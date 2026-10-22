import { ProjectLicenseSettingsForm } from '@/components/user-dashboard/projects/edit/license-settings-form'

interface LicensePageProps {
	params: Promise<{
		id: string
	}>
}

export default async function LicensePage({ params }: LicensePageProps) {
	const { id } = await params

	return <ProjectLicenseSettingsForm id={id} />
}
