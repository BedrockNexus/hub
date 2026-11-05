import { AdminOverview } from '@/components/admin-dashboard/admin-overview'
import { ReviewQueue } from '@/components/admin-dashboard/review-queue'

export default function AdminPage() {
	return (
		<>
			<ReviewQueue />
			<AdminOverview />
		</>
	)
}
