import type { Metadata } from 'next'
import { AdminProjectReview } from '@/components/admin-dashboard/admin-project-review'

export const metadata: Metadata = { title: 'Review addon' }

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <AdminProjectReview projectId={id} />
}
