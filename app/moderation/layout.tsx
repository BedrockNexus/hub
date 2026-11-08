import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ModerationHeader } from '@/components/moderation/moderation-header'
import { ModerationSidebar } from '@/components/moderation/moderation-sidebar'
import { WorkspaceLayout } from '@/components/workspace-layout'
import { api } from '@/convex/_generated/api'
import { canModerate, isAdminRole } from '@/convex/lib/roles'
import { fetchAuthQuery, isAuthenticated } from '@/lib/auth-server'

export const metadata: Metadata = {
	title: 'Moderation',
	robots: {
		index: false,
		follow: false,
	},
}

export default async function ModerationLayout({
	children,
}: {
	children: React.ReactNode
}) {
	if (!(await isAuthenticated())) {
		redirect('/login')
	}

	const user = await fetchAuthQuery(api.auth.getCurrentUser)
	if (!canModerate(user?.role)) {
		redirect('/dashboard')
	}
	const isAdmin = isAdminRole(user?.role)

	return (
		<WorkspaceLayout
			header={<ModerationHeader />}
			sidebar={
				<ModerationSidebar
					className="top-16 h-[calc(100svh-4rem)]"
					isAdmin={isAdmin}
				/>
			}
		>
			{children}
		</WorkspaceLayout>
	)
}
