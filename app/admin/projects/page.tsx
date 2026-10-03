import { AdminProjectsTable } from '@/components/admin-dashboard/admin-projects-table'
import { AdminPendingReleases } from '@/components/admin-dashboard/admin-release-review'

export default function AdminProjectsPage() {
	return (
		<>
			<AdminPendingReleases />
			<AdminProjectsTable />
		</>
	)
}
