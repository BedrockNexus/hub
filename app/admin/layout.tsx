import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminDashboardHeader } from '@/components/admin-dashboard/admin-dashboard-header'
import { AdminDashboardSidebar } from '@/components/admin-dashboard/admin-dashboard-sidebar'
import { WorkspaceLayout } from '@/components/workspace-layout'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery, isAuthenticated } from '@/lib/auth-server'

export const metadata: Metadata = {
	title: 'Admin',
	robots: {
		index: false,
		follow: false,
	},
}

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const authenticated = await isAuthenticated()

	if (!authenticated) {
		redirect('/login')
	}

	const user = await fetchAuthQuery(api.auth.getCurrentUser)

	if (user?.role !== 'admin') {
		redirect('/dashboard')
	}

	return (
		<WorkspaceLayout
			header={<AdminDashboardHeader />}
			sidebar={
				<AdminDashboardSidebar className="top-16 h-[calc(100svh-4rem)]" />
			}
		>
			{children}
		</WorkspaceLayout>
	)
}
