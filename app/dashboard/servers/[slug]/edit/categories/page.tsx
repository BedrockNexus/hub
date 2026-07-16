import { CategoriesSettingsForm } from '@/components/user-dashboard/servers/edit/categories-settings-form'

interface CategoriesPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
	const { slug } = await params

	return <CategoriesSettingsForm slug={slug} />
}
