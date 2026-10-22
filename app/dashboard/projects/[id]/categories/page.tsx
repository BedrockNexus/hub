import { ProjectCategoriesSettingsForm } from '@/components/user-dashboard/projects/edit/categories-settings-form'

interface CategoriesPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
	const { id } = await params

	return <ProjectCategoriesSettingsForm id={id} />
}
