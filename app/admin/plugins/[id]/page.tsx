import type { Metadata } from 'next'
import { AdminPluginReview } from '@/components/admin-dashboard/admin-plugin-review'

export const metadata: Metadata = {
	title: 'Review plugin submission',
	robots: { index: false, follow: false },
}
export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <AdminPluginReview pluginId={id} />
}
