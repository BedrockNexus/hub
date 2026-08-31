import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

interface WorkspaceLayoutProps {
	children: ReactNode
	header: ReactNode
	sidebar: ReactNode
}

export function WorkspaceLayout({
	children,
	header,
	sidebar,
}: WorkspaceLayoutProps) {
	return (
		<NuqsAdapter>
			<SidebarProvider className="pt-16">
				{header}
				{sidebar}
				<SidebarInset>
					<div className="mx-auto flex w-full min-w-0 max-w-[96rem] flex-1 flex-col gap-6 p-4 md:p-6">
						{children}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</NuqsAdapter>
	)
}
