import type { Metadata } from 'next'
import { AdminProjectsTable } from '@/components/admin-dashboard/admin-projects-table'

export const metadata: Metadata = { title: 'Resource Packs' }

export default function Page() {
	return <AdminProjectsTable type="resource_pack" />
}
