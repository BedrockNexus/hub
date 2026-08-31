import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/user-dashboard/dashboard-header'
import { DashboardSidebar } from '@/components/user-dashboard/dashboard-sidebar'
import { WorkspaceLayout } from '@/components/workspace-layout'
import { isAuthenticated } from '@/lib/auth-server'
import { getSiteSocials } from '@/lib/site-settings'

export const metadata: Metadata = {
	title: 'Dashboard',
	robots: {
		index: false,
		follow: false,
	},
}

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const authenticated = await isAuthenticated()

	if (!authenticated) {
		redirect('/login')
	}

	const socials = await getSiteSocials()

	return (
		<WorkspaceLayout
			header={<DashboardHeader />}
			sidebar={
				<DashboardSidebar
					className="top-16 h-[calc(100svh-4rem)]"
					socials={socials}
				/>
			}
		>
			{children}
		</WorkspaceLayout>
	)
}
