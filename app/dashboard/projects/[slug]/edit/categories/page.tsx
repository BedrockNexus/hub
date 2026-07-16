import { ProjectCategoriesSettingsForm } from '@/components/user-dashboard/projects/edit/categories-settings-form'

interface CategoriesPageProps {
	params: Promise<{
		slug: string
	}>
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
	const { slug } = await params

	return <ProjectCategoriesSettingsForm slug={slug} />
}
