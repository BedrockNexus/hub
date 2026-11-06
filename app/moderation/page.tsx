import type { Metadata } from 'next'
import { AdminPageHeader } from '@/components/admin-dashboard/admin-page-header'
import { ReviewQueue } from '@/components/admin-dashboard/review-queue'

export const metadata: Metadata = { title: 'Awaiting review' }

export default function ModerationPage() {
	return (
		<div className="space-y-6">
			<AdminPageHeader
				description="Review listing and version submissions across servers, addons, resource packs, and plugins."
				title="Awaiting review"
			/>
			<ReviewQueue />
		</div>
	)
}
