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

interface ProjectSwitcherProps {
	currentSlug: string
	basePath?: string
}

export function ProjectSwitcher({
	currentSlug,
	basePath = '/dashboard',
}: ProjectSwitcherProps) {
	const router = useRouter()
	const pathname = usePathname()
	const projects = useQuery(api.functions.projects.projects.listMyContent)
	const currentProject = projects?.find((p) => p.slug === currentSlug)

	if (!(projects && currentProject)) {
		return null
	}

	const editBasePath = `${basePath}/projects/${currentSlug}/edit`
	const subPath = pathname.replace(editBasePath, '') || ''

	const handleSwitch = (slug: string) => {
		router.push(`${basePath}/projects/${slug}/edit${subPath}`)
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
							{currentProject.iconUrl ? (
								<Image
									alt={currentProject.name}
									className="size-8 rounded-lg border object-cover"
									height={32}
									src={currentProject.iconUrl}
									width={32}
								/>
							) : (
								<div className="flex size-8 items-center justify-center rounded-lg border bg-muted font-bold text-sm">
									{currentProject.name.charAt(0)}
								</div>
							)}
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">
								{currentProject.name}
							</span>
							<span className="truncate text-muted-foreground text-xs">
								{currentProject.summary}
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
						{projects.map((project) => (
							<DropdownMenuItem
								key={project.slug}
								onClick={() => handleSwitch(project.slug)}
							>
								{project.iconUrl ? (
									<Image
										alt={project.name}
										className="size-6 rounded border object-cover"
										height={24}
										src={project.iconUrl}
										width={24}
									/>
								) : (
									<div className="flex size-6 items-center justify-center rounded border bg-muted font-bold text-xs">
										{project.name.charAt(0)}
									</div>
								)}
								<span>{project.name}</span>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() =>
								router.push(`${basePath}/projects/add`)
							}
						>
							<HugeiconsIcon icon={Add01Icon} size={16} />
							<span>Add Project</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
