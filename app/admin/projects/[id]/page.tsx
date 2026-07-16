import { AdminProjectReview } from '@/components/admin-dashboard/admin-project-review'

export default async function AdminProjectReviewPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <AdminProjectReview projectId={id} />
}
