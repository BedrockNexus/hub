import { GeneralSettingsForm } from '@/components/user-dashboard/servers/edit/general-settings-form'

interface EditServerPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function EditServerPage({ params }: EditServerPageProps) {
	const { slug } = await params

	return <GeneralSettingsForm slug={slug} />
}
