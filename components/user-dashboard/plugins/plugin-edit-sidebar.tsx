'use client'

import {
	ArrowLeft02Icon,
	CheckmarkCircle01Icon,
	Delete02Icon,
	Flag01Icon,
	InformationCircleIcon,
	Link04Icon,
	Package01Icon,
	TextIcon,
	ViewIcon,
	WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useConvexAuth, useQuery } from 'convex/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { PluginAvatar } from '@/components/plugins/plugin-card'
import { DeletePluginDialog } from '@/components/plugins/publishing/delete-plugin-dialog'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from '@/components/ui/sidebar'
import { api } from '@/convex/_generated/api'

const NAV_SECTIONS = [
	{ id: '', title: 'General', icon: InformationCircleIcon, exactMatch: true },
	{ id: '/description', title: 'Description', icon: TextIcon },
	{ id: '/links', title: 'Links', icon: Link04Icon },
	{ id: '/workflow', title: 'Workflow', icon: WorkflowSquare01Icon },
	{ id: '/releases', title: 'Builds & versions', icon: Package01Icon },
] as const

/**
 * Settings for one plugin, the same shape as the project and server edit
 * sidebars. `reference` is the plugin's dashboard id from the URL.
 */
export function PluginEditSidebar({
	reference,
	...props
}: React.ComponentProps<typeof Sidebar> & { reference: string }) {
	const pathname = usePathname()
	const auth = useConvexAuth()
	const editPath = `/dashboard/plugins/${reference}`
	const [deleteOpen, setDeleteOpen] = useState(false)

	const draftId = useQuery(
		api.functions.plugins.publishing.model.resolveMine,
		auth.isAuthenticated ? { reference } : 'skip',
	)
	const plugin = useQuery(
		api.functions.plugins.publishing.model.getMine,
		draftId ? { draftId } : 'skip',
	)

	const isActive = (sectionPath: string, exactMatch?: boolean) => {
		const fullPath = `${editPath}${sectionPath}`
		return exactMatch
			? pathname === fullPath
			: pathname === fullPath || pathname.startsWith(`${fullPath}/`)
	}

	const status = plugin?.project?.status
	const isPublic =
		status === 'published' && plugin?.project?.visibility === 'public'

	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarHeader>
				<div className="flex items-center gap-2.5 p-1 group-data-[collapsible=icon]:p-0">
					<PluginAvatar
						avatarUrl={plugin?.draft.iconUrl}
						className="size-9 shrink-0 group-data-[collapsible=icon]:size-8"
						name={plugin?.draft.name ?? '?'}
					/>
					<div className="min-w-0 group-data-[collapsible=icon]:hidden">
						<p className="truncate font-semibold text-sm">
							{plugin?.draft.name ?? 'Plugin'}
						</p>
						<p className="truncate text-muted-foreground text-xs">
							{plugin?.softwareName ?? 'Plugin'}
						</p>
					</div>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link href="/dashboard/plugins" />}
									tooltip="Back to Plugins"
								>
									<HugeiconsIcon
										icon={ArrowLeft02Icon}
										size={16}
									/>
									<span>Back to Plugins</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup>
					<SidebarGroupLabel>Settings</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV_SECTIONS.map((section) => (
								<SidebarMenuItem key={section.id}>
									<SidebarMenuButton
										isActive={isActive(
											section.id,
											'exactMatch' in section &&
												section.exactMatch,
										)}
										render={
											<Link
												href={`${editPath}${section.id}`}
											/>
										}
										tooltip={section.title}
									>
										<HugeiconsIcon
											icon={section.icon}
											size={16}
										/>
										<span>{section.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					{plugin?.locked ? (
						<SidebarMenuItem>
							<SidebarMenuButton disabled tooltip="In review">
								<HugeiconsIcon icon={Flag01Icon} size={16} />
								<span>In review</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{isPublic && plugin?.project ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										href={`/plugins/${plugin.project.slug}`}
									/>
								}
								tooltip="View public page"
							>
								<HugeiconsIcon icon={ViewIcon} size={16} />
								<span>View public page</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{status === 'published' && !plugin?.locked ? (
						<SidebarMenuItem>
							<SidebarMenuButton disabled tooltip="Published">
								<HugeiconsIcon
									icon={CheckmarkCircle01Icon}
									size={16}
								/>
								<span>Published</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					<SidebarMenuItem>
						<SidebarMenuButton
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
							disabled={!plugin}
							onClick={() => setDeleteOpen(true)}
							tooltip="Delete Plugin"
						>
							<HugeiconsIcon icon={Delete02Icon} size={16} />
							<span>Delete Plugin</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			{plugin ? (
				<DeletePluginDialog
					draftId={plugin.draft._id}
					name={plugin.draft.name}
					onOpenChange={setDeleteOpen}
					open={deleteOpen}
					slug={plugin.draft.slug}
				/>
			) : null}
		</Sidebar>
	)
}
