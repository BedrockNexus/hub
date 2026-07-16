import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { AdminDashboardHeader } from '@/components/admin-dashboard/admin-dashboard-header'
import { AdminDashboardSidebar } from '@/components/admin-dashboard/admin-dashboard-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery, isAuthenticated } from '@/lib/auth-server'
import { getSiteSeo } from '@/lib/site-settings'

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

	const [user, seo] = await Promise.all([
		fetchAuthQuery(api.auth.getCurrentUser),
		getSiteSeo(),
	])

	if (user?.role !== 'admin') {
		redirect('/dashboard')
	}

	return (
		<NuqsAdapter>
			<SidebarProvider className="pt-16">
				<AdminDashboardHeader
					siteLogoUrl={seo.siteLogoUrl}
					siteName={seo.siteName}
				/>
				<AdminDashboardSidebar className="top-16 h-[calc(100svh-4rem)]" />
				<SidebarInset>
					<div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:pt-6">
						{children}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</NuqsAdapter>
	)
}
