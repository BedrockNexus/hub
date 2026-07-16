import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import '@mdxeditor/editor/style.css'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { DashboardHeader } from '@/components/user-dashboard/dashboard-header'
import { DashboardSidebar } from '@/components/user-dashboard/dashboard-sidebar'
import { isAuthenticated } from '@/lib/auth-server'
import { getSiteSeo, getSiteSocials } from '@/lib/site-settings'

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

	const [seo, socials] = await Promise.all([getSiteSeo(), getSiteSocials()])

	return (
		<NuqsAdapter>
			<SidebarProvider className="pt-16">
				<DashboardHeader
					siteLogoUrl={seo.siteLogoUrl}
					siteName={seo.siteName}
				/>
				<DashboardSidebar
					className="top-16 h-[calc(100svh-4rem)]"
					socials={socials}
				/>
				<SidebarInset>
					<div className="flex flex-1 flex-col gap-4 p-4 md:pt-6">
						{children}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</NuqsAdapter>
	)
}
