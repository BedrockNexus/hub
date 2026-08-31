'use client'

import type { UserButtonLink } from '@/components/ba-ui/user/user-button'
import { UserButton } from '@/components/ba-ui/user/user-button'
import { BrandMark } from '@/components/brand-mark'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

interface WorkspaceHeaderProps {
	label: string
	links: UserButtonLink[]
}

export function WorkspaceHeader({ label, links }: WorkspaceHeaderProps) {
	return (
		<header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-md lg:px-6">
			<div className="flex min-w-0 items-center gap-3">
				<SidebarTrigger className="-ml-1" />
				<BrandMark imageClassName="w-36 sm:w-40" priority />
				<Separator
					className="hidden h-5 sm:block"
					orientation="vertical"
				/>
				<span className="hidden truncate text-muted-foreground text-sm sm:block">
					{label}
				</span>
			</div>
			<UserButton align="end" links={links} size="icon" />
		</header>
	)
}
