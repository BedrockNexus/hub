import type { Metadata } from 'next'
import { ReviewQueue } from '@/components/admin-dashboard/review-queue'

export const metadata: Metadata = { title: 'Review queue' }

export default function ModerationPage() {
	return (
		<div className="mx-auto w-full max-w-[1080px]">
			<ReviewQueue />
		</div>
	)
}
