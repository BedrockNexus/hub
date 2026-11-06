import type { Metadata } from 'next'
import { AdminPluginsTable } from '@/components/admin-dashboard/admin-plugins-table'
export const metadata: Metadata = {
	title: 'Plugins',
	robots: { index: false, follow: false },
}
export default function Page() {
	return <AdminPluginsTable />
}
