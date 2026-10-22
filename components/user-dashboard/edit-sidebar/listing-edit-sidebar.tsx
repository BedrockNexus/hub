'use client'

import {
	ArrowLeft02Icon,
	CheckmarkCircle01Icon,
	Delete02Icon,
	Flag01Icon,
	NoteEditIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import type { IconType } from '@/components/detail/detail-parts'
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
import {
	DeleteListingDialog,
	type ListingDeletion,
} from '@/components/user-dashboard/edit-sidebar/delete-listing-dialog'

export interface EditSection {
	/** Sub-path after the item's base URL; '' is General. */
	id: string
	title: string
	icon: IconType
	exactMatch?: boolean
}

export type ListingStatus = 'draft' | 'in_review' | 'published'

const STATUS: Record<ListingStatus, { label: string; icon: IconType }> = {
	draft: { label: 'Draft', icon: NoteEditIcon },
	in_review: { label: 'In review', icon: Flag01Icon },
	published: { label: 'Published', icon: CheckmarkCircle01Icon },
}

/** The next step for the item: a link to a page, or an action to run. */
export interface ListingAction {
	label: string
	icon: IconType
	href?: string
	onRun?: () => Promise<void>
}

/**
 * The edit sidebar shared by servers, projects and plugins, so all three have
 * the same layout and flow: the switcher, a way back, any moderation note,
 * the settings pages, then the status, the next step, the public page and
 * deletion.
 */
export function ListingEditSidebar({
	basePath,
	id,
	header,
	backLabel,
	sections,
	moderationNote,
	status,
	action,
	publicHref,
	deletion,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	/** e.g. `/dashboard/servers`; the item's pages are under `${basePath}/${id}`. */
	basePath: string
	id: string
	header: React.ReactNode
	backLabel: string
	sections: readonly EditSection[]
	moderationNote?: string
	status?: ListingStatus
	action?: ListingAction
	publicHref?: string
	deletion?: ListingDeletion
}) {
	const pathname = usePathname()
	const [running, setRunning] = useState(false)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const editPath = `${basePath}/${id}`

	const isActive = (section: EditSection) => {
		const fullPath = `${editPath}${section.id}`
		return section.exactMatch
			? pathname === fullPath
			: pathname === fullPath || pathname.startsWith(`${fullPath}/`)
	}

	const run = async (operation: () => Promise<void>) => {
		setRunning(true)
		try {
			await operation()
		} finally {
			setRunning(false)
		}
	}

	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarHeader>{header}</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link href={basePath as Route} />}
									tooltip={backLabel}
								>
									<HugeiconsIcon
										icon={ArrowLeft02Icon}
										size={16}
									/>
									<span>{backLabel}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				{moderationNote ? (
					<div className="mx-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs group-data-[collapsible=icon]:hidden">
						<p className="font-medium">Moderation note</p>
						<p className="mt-1 whitespace-pre-line text-muted-foreground">
							{moderationNote}
						</p>
					</div>
				) : null}

				<SidebarGroup>
					<SidebarGroupLabel>Settings</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{sections.map((section) => (
								<SidebarMenuItem key={section.id}>
									<SidebarMenuButton
										isActive={isActive(section)}
										render={
											<Link
												href={
													`${editPath}${section.id}` as Route
												}
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
					{status ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								aria-disabled
								className="pointer-events-none text-muted-foreground"
								tooltip={STATUS[status].label}
							>
								<HugeiconsIcon
									icon={STATUS[status].icon}
									size={16}
								/>
								<span>{STATUS[status].label}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					{action ? (
						<SidebarMenuItem>
							{action.href ? (
								<SidebarMenuButton
									render={
										<Link href={action.href as Route} />
									}
									tooltip={action.label}
								>
									<HugeiconsIcon
										icon={action.icon}
										size={16}
									/>
									<span>{action.label}</span>
								</SidebarMenuButton>
							) : (
								<SidebarMenuButton
									disabled={running || !action.onRun}
									onClick={() =>
										action.onRun && run(action.onRun)
									}
									tooltip={action.label}
								>
									{running ? (
										<Spinner className="size-4" />
									) : (
										<HugeiconsIcon
											icon={action.icon}
											size={16}
										/>
									)}
									<span>{action.label}</span>
								</SidebarMenuButton>
							)}
						</SidebarMenuItem>
					) : null}
					{publicHref ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								render={<Link href={publicHref as Route} />}
								tooltip="View public page"
							>
								<HugeiconsIcon icon={ViewIcon} size={16} />
								<span>View public page</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}
					<SidebarMenuItem>
						<SidebarMenuButton
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
							disabled={!deletion}
							onClick={() => setDeleteOpen(true)}
							tooltip="Delete"
						>
							<HugeiconsIcon icon={Delete02Icon} size={16} />
							<span>Delete</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			{deletion ? (
				<DeleteListingDialog
					deletion={deletion}
					onOpenChange={setDeleteOpen}
					open={deleteOpen}
				/>
			) : null}
		</Sidebar>
	)
}
