import type { Metadata } from 'next'
import { AdminProjectsTable } from '@/components/admin-dashboard/admin-projects-table'

export const metadata: Metadata = { title: 'Addons' }

export default function Page() {
	return <AdminProjectsTable type="addon" />
}
