'use client'
import {
	ArrowLeft02Icon,
	Clock01Icon,
	Image02Icon,
	InformationCircleIcon,
	Link04Icon,
	NoteEditIcon,
	Package01Icon,
	TextIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import type { ComponentProps } from 'react'
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
	useSidebar,
} from '@/components/ui/sidebar'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useAdminReviewNavigation } from '@/hooks/use-admin-review-navigation'
import {
	type adminReviewTarget,
	moderationCollectionHref,
	REVIEW_SECTIONS,
} from '@/lib/admin-review-navigation'
import {
	normalizeProjectType,
	PROJECT_TYPE_PLURAL_LABELS,
} from '@/lib/project-artifacts'
import { SubmissionStatusBadge } from './submission-status'

const ICONS = {
	overview: InformationCircleIcon,
	changes: NoteEditIcon,
	description: TextIcon,
	gallery: Image02Icon,
	versions: Package01Icon,
	links: Link04Icon,
	history: Clock01Icon,
}
export function AdminReviewSidebar({
	target,
	...props
}: ComponentProps<typeof Sidebar> & {
	target: NonNullable<ReturnType<typeof adminReviewTarget>>
}) {
	const nav = useAdminReviewNavigation()
	const { setOpenMobile } = useSidebar()
	const project = useQuery(
		api.functions.projects.projects.getAdminReview,
		target.kind === 'projects'
			? { id: target.id as Id<'projects'> }
			: 'skip',
	)
	const server = useQuery(
		api.functions.servers.servers.getAdminReview,
		target.kind === 'servers' ? { id: target.id as Id<'servers'> } : 'skip',
	)
	const plugin = useQuery(
		api.functions.plugins.projects.getAdminReview,
		target.kind === 'plugins' ? { id: target.id } : 'skip',
	)
	const item = project ?? server ?? plugin?.project
	const name = plugin?.draft?.name ?? item?.name ?? 'Submission review'
	const image =
		project?.iconUrl ??
		server?.logoUrl ??
		plugin?.draft?.iconUrl ??
		plugin?.project.iconUrl
	let catalog = { href: '/moderation/plugins', label: 'Plugins' }
	if (target.kind === 'servers') {
		catalog = { href: '/moderation/servers', label: 'Servers' }
	}
	if (target.kind === 'projects') {
		const type = project ? normalizeProjectType(project.type) : undefined
		catalog = {
			href: moderationCollectionHref('projects', type),
			label: type ? PROJECT_TYPE_PLURAL_LABELS[type] : 'Catalog',
		}
	}
	const sections = REVIEW_SECTIONS.filter(
		(section) => target.kind !== 'servers' || section.id !== 'versions',
	)
	return (
		<Sidebar collapsible="icon" variant="floating" {...props}>
			<SidebarHeader>
				<div className="flex items-center gap-3 p-2">
					{image ? (
						<Image
							alt=""
							className="size-9 rounded-md object-cover"
							height={36}
							src={image}
							width={36}
						/>
					) : (
						<HugeiconsIcon
							className="size-5 shrink-0"
							icon={InformationCircleIcon}
						/>
					)}
					<div className="min-w-0 group-data-[collapsible=icon]:hidden">
						<p className="truncate font-medium text-sm">{name}</p>
						<p className="text-muted-foreground text-xs">
							Submission review
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
									render={<Link href="/moderation" />}
									tooltip="Back to awaiting review"
								>
									<HugeiconsIcon
										icon={ArrowLeft02Icon}
										size={16}
									/>
									<span>Awaiting review</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarSeparator />
				<SidebarGroup>
					<SidebarGroupLabel>Review sections</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{sections.map((section) => (
								<SidebarMenuItem key={section.id}>
									<SidebarMenuButton
										isActive={section.id === nav.section}
										onClick={() => {
											nav.selectSection(section.id)
											setOpenMobile(false)
										}}
										tooltip={section.title}
									>
										<HugeiconsIcon
											icon={ICONS[section.id]}
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
				<div className="px-2 group-data-[collapsible=icon]:hidden">
					<SubmissionStatusBadge status={item?.submissionStatus} />
				</div>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={<Link href={catalog.href} />}
							tooltip={catalog.label}
						>
							<HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
							<span>{catalog.label}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	)
}
