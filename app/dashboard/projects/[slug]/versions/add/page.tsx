import { redirect } from 'next/navigation'

interface AddVersionPageProps {
	params: Promise<{ slug: string }>
}

export default async function AddVersionPage({ params }: AddVersionPageProps) {
	const { slug } = await params
	redirect(`/dashboard/projects/${slug}/edit/versions/add`)
}
