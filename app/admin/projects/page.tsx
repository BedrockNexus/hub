import { AdminProjectsTable } from '@/components/admin-dashboard/admin-projects-table'
import { ReviewQueue } from '@/components/admin-dashboard/review-queue'

export default function AdminProjectsPage() {
	return (
		<>
			<ReviewQueue />
			<AdminProjectsTable />
		</>
	)
}
