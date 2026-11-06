import { AdminServerReview } from '@/components/admin-dashboard/admin-server-review'

export default async function AdminServerReviewPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <AdminServerReview serverId={id} />
}
