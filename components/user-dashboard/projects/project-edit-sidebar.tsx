'use client'

import {
	ArrowLeft02Icon,
	CheckmarkCircle01Icon,
	Delete02Icon,
	Flag01Icon,
	GridIcon,
	Image02Icon,
	InformationCircleIcon,
	Link04Icon,
	Package01Icon,
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
import { ProjectSwitcher } from '@/components/user-dashboard/projects/project-switcher'
import { api } from '@/convex/_generated/api'

const NAV_SECTIONS = [
	{ id: '', title: 'General', icon: InformationCircleIcon, exactMatch: true },
	{ id: '/description', title: 'Description', icon: InformationCircleIcon },
	{ id: '/categories', title: 'Categories', icon: GridIcon },
	{ id: '/links', title: 'Links', icon: Link04Icon },
	{ id: '/license', title: 'License', icon: Flag01Icon },
	{ id: '/gallery', title: 'Gallery', icon: Image02Icon },
	{ id: '/versions', title: 'Versions', icon: Package01Icon },
] as const

interface ProjectEditSidebarProps extends React.ComponentProps<typeof Sidebar> {
	slug: string
	basePath?: string
}

export function ProjectEditSidebar({
	slug,
	basePath = '/dashboard',
	...props
}: ProjectEditSidebarProps) {
	const pathname = usePathname()
	const router = useRouter()
	const editPath = `${basePath}/projects/${slug}/edit`
	const [isDeleting, setIsDeleting] = useState(false)
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

	const project = useQuery(
		api.functions.projects.projects.getBySlug,
		slug ? { slug } : 'skip',
	)
	const deleteProject = useMutation(api.functions.projects.projects.remove)
	const updateProject = useMutation(api.functions.projects.projects.update)
	const hasPublishedVersion =
		!!project?.latestVersion || (project?.versionCount ?? 0) > 0

	const isActive = (sectionPath: string, exactMatch?: boolean) => {
		const fullPath = `${editPath}${sectionPath}`
		if (exactMatch) {
			return pathname === fullPath
		}
		return pathname === fullPath || pathname.startsWith(`${fullPath}/`)
	}

	const handleSubmitForReview = async () => {
		if (!project) {
			return
		}

		setIsUpdatingStatus(true)
		try {
			await updateProject({ id: project._id, status: 'under_review' })
			toast.success(`${project.name} submitted for review`)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to submit project for review'
			toast.error(message)
		} finally {
			setIsUpdatingStatus(false)
		}
	}

	const handleDelete = async () => {
		if (!project) {
			return
		}

		setIsDeleting(true)
		try {
			await deleteProject({ id: project._id })
			toast.success('Project deleted successfully')
			router.push(`${basePath}/projects`)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to delete project'
			toast.error(message)
		} finally {
			setIsDeleting(false)
		}
	}

	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarHeader>
				<ProjectSwitcher basePath={basePath} currentSlug={slug} />
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link href={`${basePath}/projects`} />
									}
									tooltip="Back to Projects"
								>
									<HugeiconsIcon
										icon={ArrowLeft02Icon}
										size={16}
									/>
									<span>Back to Projects</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				{project?.moderationReason ? (
					<div className="mx-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs group-data-[collapsible=icon]:hidden">
						<p className="font-medium">Moderation note</p>
						<p className="mt-1 text-muted-foreground">
							{project.moderationReason}
						</p>
					</div>
				) : null}

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
					{project?.status === 'draft' && !hasPublishedVersion ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link href={`${editPath}/versions/add`} />
								}
								tooltip="Add a version before review"
							>
								<HugeiconsIcon icon={Package01Icon} size={16} />
								<span>Add Version First</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{project?.status === 'draft' && hasPublishedVersion ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								disabled={isUpdatingStatus}
								onClick={handleSubmitForReview}
								tooltip="Submit for Review"
							>
								{isUpdatingStatus ? (
									<Spinner className="size-4" />
								) : (
									<HugeiconsIcon
										icon={CheckmarkCircle01Icon}
										size={16}
									/>
								)}
								<span>Submit for Review</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{project?.status === 'under_review' ? (
						<SidebarMenuItem>
							<SidebarMenuButton disabled tooltip="Under Review">
								<HugeiconsIcon icon={Flag01Icon} size={16} />
								<span>Under Review</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{project?.status === 'published' ? (
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
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<SidebarMenuButton
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										tooltip="Delete Project"
									/>
								}
							>
								<HugeiconsIcon icon={Delete02Icon} size={16} />
								<span>Delete Project</span>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Are you sure?
									</AlertDialogTitle>
									<AlertDialogDescription>
										This will permanently delete{' '}
										<strong>{project?.name ?? slug}</strong>{' '}
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
