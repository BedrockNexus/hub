import { DashboardOverview } from '@/components/user-dashboard/dashboard-overview'
import { ReviewNotices } from '@/components/user-dashboard/review-notices'

export default function DashboardPage() {
	return (
		<>
			<ReviewNotices />
			<DashboardOverview />
		</>
	)
}
