import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { PublishingReviewQueue } from '@/components/plugins/publishing/publishing-review-queue'

export const metadata: Metadata = {
	title: 'Publishing reviews',
	robots: { index: false, follow: false },
}

export default function PublishingReviewsPage() {
	return (
		<DashboardPageShell
			description="Review the exact verified release, repository, workflow correlation, asset, and metadata before making a project public."
			eyebrow="Moderation"
			title="Publishing reviews"
		>
			<PublishingReviewQueue />
		</DashboardPageShell>
	)
}
