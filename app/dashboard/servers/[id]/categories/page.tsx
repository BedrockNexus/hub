import { CategoriesSettingsForm } from '@/components/user-dashboard/servers/edit/categories-settings-form'
import { canonicalServerSettings } from '@/lib/canonical-content'

interface CategoriesPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
	const { id } = await params
	await canonicalServerSettings(id, '/categories')

	return <CategoriesSettingsForm id={id} />
}
