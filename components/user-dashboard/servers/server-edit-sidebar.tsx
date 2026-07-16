'use client'

import {
	ArrowLeft02Icon,
	Delete02Icon,
	Flag01Icon,
	GridIcon,
	Image02Icon,
	InformationCircleIcon,
	Link04Icon,
	PaintBoardIcon,
	ViewIcon,
	ViewOffSlashIcon,
	Wifi01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { Spinner } from '@/components/ui/spinner'
import { ServerSwitcher } from '@/components/user-dashboard/servers/server-switcher'
import { api } from '@/convex/_generated/api'

const NAV_SECTIONS = [
	{ id: '', title: 'General', icon: InformationCircleIcon, exactMatch: true },
	{ id: '/description', title: 'Description', icon: InformationCircleIcon },
	{ id: '/connection', title: 'Connection', icon: Wifi01Icon },
	{ id: '/branding', title: 'Branding', icon: PaintBoardIcon },
	{ id: '/categories', title: 'Categories', icon: GridIcon },
	{ id: '/links', title: 'Links', icon: Link04Icon },
	{ id: '/gallery', title: 'Gallery', icon: Image02Icon },
] as const

type OwnerServerLifecycleStatus = 'draft' | 'published'

interface ServerEditSidebarProps extends React.ComponentProps<typeof Sidebar> {
	slug: string
	basePath?: string
}

export function ServerEditSidebar({
	slug,
	basePath = '/dashboard',
	...props
}: ServerEditSidebarProps) {
	const pathname = usePathname()
	const router = useRouter()
	const editPath = `${basePath}/servers/${slug}/edit`
	const [isDeleting, setIsDeleting] = useState(false)
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

	const server = useQuery(
		api.functions.servers.servers.getBySlug,
		slug ? { slug } : 'skip',
	)
	const deleteServer = useMutation(api.functions.servers.servers.remove)
	const updateServer = useMutation(api.functions.servers.servers.update)

	const isActive = (sectionPath: string, exactMatch?: boolean) => {
		const fullPath = `${editPath}${sectionPath}`
		if (exactMatch) {
			return pathname === fullPath
		}
		return pathname === fullPath || pathname.startsWith(`${fullPath}/`)
	}

	const handleDelete = async () => {
		if (!server) {
			return
		}

		setIsDeleting(true)
		try {
			await deleteServer({ id: server._id })
			toast.success('Server deleted successfully')
			router.push(`${basePath}/servers`)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to delete server'
			toast.error(message)
		} finally {
			setIsDeleting(false)
		}
	}

	const handleSetLifecycleStatus = async (
		status: OwnerServerLifecycleStatus,
	) => {
		if (!server) {
			return
		}

		setIsUpdatingStatus(true)
		try {
			await updateServer({ id: server._id, status })
			toast.success(
				status === 'published'
					? `${server.name} is now published`
					: `${server.name} moved to draft`,
			)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to update server status'
			toast.error(message)
		} finally {
			setIsUpdatingStatus(false)
		}
	}

	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarHeader>
				<ServerSwitcher basePath={basePath} currentSlug={slug} />
			</SidebarHeader>

			<SidebarContent>
				{/* Back to Servers */}
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link href={`${basePath}/servers`} />
									}
									tooltip="Back to Servers"
								>
									<HugeiconsIcon
										icon={ArrowLeft02Icon}
										size={16}
									/>
									<span>Back to Servers</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				{server?.moderationReason ? (
					<div className="mx-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs group-data-[collapsible=icon]:hidden">
						<p className="font-medium">Moderation note</p>
						<p className="mt-1 text-muted-foreground">
							{server.moderationReason}
						</p>
					</div>
				) : null}

				{/* Section Nav */}
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
					{server?.status === 'draft' ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								disabled={isUpdatingStatus}
								onClick={() =>
									handleSetLifecycleStatus('published')
								}
								tooltip="Publish Server"
							>
								{isUpdatingStatus ? (
									<Spinner className="size-4" />
								) : (
									<HugeiconsIcon icon={ViewIcon} size={16} />
								)}
								<span>Publish Server</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{server?.status === 'published' ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								disabled={isUpdatingStatus}
								onClick={() =>
									handleSetLifecycleStatus('draft')
								}
								tooltip="Move to Draft"
							>
								{isUpdatingStatus ? (
									<Spinner className="size-4" />
								) : (
									<HugeiconsIcon
										icon={ViewOffSlashIcon}
										size={16}
									/>
								)}
								<span>Move to Draft</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{server?.status === 'under_review' ? (
						<SidebarMenuItem>
							<SidebarMenuButton disabled tooltip="Under Review">
								<HugeiconsIcon icon={Flag01Icon} size={16} />
								<span>Under Review</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					<SidebarMenuItem>
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<SidebarMenuButton
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										tooltip="Delete Server"
									/>
								}
							>
								<HugeiconsIcon icon={Delete02Icon} size={16} />
								<span>Delete Server</span>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Are you sure?
									</AlertDialogTitle>
									<AlertDialogDescription>
										This will permanently delete{' '}
										<strong>{server?.name ?? slug}</strong>{' '}
										and all associated data. This action
										cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										disabled={isDeleting}
										onClick={handleDelete}
									>
										{isDeleting ? (
											<>
												<Spinner className="size-4" />
												Deleting...
											</>
										) : (
											'Delete'
										)}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	)
}
