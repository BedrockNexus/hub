import { CategoriesSettingsForm } from '@/components/user-dashboard/servers/edit/categories-settings-form'

interface CategoriesPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
	const { id } = await params

	return <CategoriesSettingsForm id={id} />
}
