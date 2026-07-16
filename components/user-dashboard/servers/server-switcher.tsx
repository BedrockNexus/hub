'use client'

import { Add01Icon, UnfoldMoreIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar'
import { api } from '@/convex/_generated/api'

interface ServerSwitcherProps {
	currentSlug: string
	basePath?: string
}

export function ServerSwitcher({
	currentSlug,
	basePath = '/dashboard',
}: ServerSwitcherProps) {
	const router = useRouter()
	const pathname = usePathname()
	const servers = useQuery(api.functions.servers.servers.listMyServers)
	const currentServer = servers?.find((s) => s.slug === currentSlug)

	if (!(servers && currentServer)) {
		return null
	}

	// Preserve current sub-path when switching servers
	const editBasePath = `${basePath}/servers/${currentSlug}/edit`
	const subPath = pathname.replace(editBasePath, '') || ''

	const handleSwitch = (slug: string) => {
		router.push(`${basePath}/servers/${slug}/edit${subPath}`)
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								size="lg"
							/>
						}
					>
						<div className="flex aspect-square size-8 items-center justify-center">
							{currentServer.logoUrl ? (
								<Image
									alt={currentServer.name}
									className="size-8 rounded-lg border object-cover"
									height={32}
									src={currentServer.logoUrl}
									width={32}
								/>
							) : (
								<div className="flex size-8 items-center justify-center rounded-lg border bg-muted font-bold text-sm">
									{currentServer.name.charAt(0)}
								</div>
							)}
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">
								{currentServer.name}
							</span>
							<span className="truncate text-muted-foreground text-xs">
								{currentServer.ipAddress}
							</span>
						</div>
						<HugeiconsIcon
							className="text-muted-foreground"
							icon={UnfoldMoreIcon}
							size={16}
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="min-w-56"
						side="bottom"
					>
						{servers.map((server) => (
							<DropdownMenuItem
								key={server.slug}
								onClick={() => handleSwitch(server.slug)}
							>
								{server.logoUrl ? (
									<Image
										alt={server.name}
										className="size-6 rounded border object-cover"
										height={24}
										src={server.logoUrl}
										width={24}
									/>
								) : (
									<div className="flex size-6 items-center justify-center rounded border bg-muted font-bold text-xs">
										{server.name.charAt(0)}
									</div>
								)}
								<span>{server.name}</span>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() =>
								router.push(`${basePath}/servers/add`)
							}
						>
							<HugeiconsIcon icon={Add01Icon} size={16} />
							<span>Add Server</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
