'use client'

import {
	CheckmarkCircle01Icon,
	GridIcon,
	Image02Icon,
	InformationCircleIcon,
	LicenseIcon,
	Link04Icon,
	Package01Icon,
	TextIcon,
} from '@hugeicons/core-free-icons'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { toast } from 'sonner'
import type { Sidebar } from '@/components/ui/sidebar'
import {
	type EditSection,
	type ListingAction,
	ListingEditSidebar,
} from '@/components/user-dashboard/edit-sidebar/listing-edit-sidebar'
import { ListingSwitcher } from '@/components/user-dashboard/edit-sidebar/listing-switcher'
import { api } from '@/convex/_generated/api'

const BASE_PATH = '/dashboard/projects'

const SECTIONS: readonly EditSection[] = [
	{ id: '', title: 'General', icon: InformationCircleIcon, exactMatch: true },
	{ id: '/description', title: 'Description', icon: TextIcon },
	{ id: '/categories', title: 'Categories', icon: GridIcon },
	{ id: '/links', title: 'Links', icon: Link04Icon },
	{ id: '/license', title: 'License', icon: LicenseIcon },
	{ id: '/gallery', title: 'Gallery', icon: Image02Icon },
	{ id: '/versions', title: 'Versions', icon: Package01Icon },
]

export function ProjectEditSidebar({
	id,
	...props
}: React.ComponentProps<typeof Sidebar> & { id: string }) {
	const router = useRouter()
	const project = useQuery(api.functions.projects.projects.getForEdit, { id })
	const projects = useQuery(api.functions.projects.projects.listMyContent)
	const deleteProject = useMutation(api.functions.projects.projects.remove)
	const updateProject = useMutation(api.functions.projects.projects.update)
	const hasVersion =
		!!project?.latestVersion || (project?.versionCount ?? 0) > 0

	let action: ListingAction | undefined
	if (project?.status === 'draft') {
		action = hasVersion
			? {
					label: 'Submit for review',
					icon: CheckmarkCircle01Icon,
					onRun: async () => {
						try {
							await updateProject({
								id: project._id,
								status: 'under_review',
							})
							toast.success(
								`${project.name} submitted for review`,
							)
						} catch (error) {
							toast.error(
								error instanceof Error
									? error.message
									: 'Failed to submit project for review',
							)
						}
					},
				}
			: {
					label: 'Add a version first',
					icon: Package01Icon,
					href: `${BASE_PATH}/${id}/versions/add`,
				}
	}

	return (
		<ListingEditSidebar
			action={action}
			backLabel="Back to Projects"
			basePath={BASE_PATH}
			deletion={
				project
					? {
							name: project.name,
							confirmText: project.slug,
							description:
								'This permanently deletes the project, its versions, files, reviews and gallery.',
							onDelete: async () => {
								await deleteProject({ id: project._id })
								router.push(BASE_PATH)
							},
						}
					: undefined
			}
			header={
				<ListingSwitcher
					addHref={`${BASE_PATH}/add`}
					addLabel="Add Project"
					basePath={BASE_PATH}
					current={
						project
							? {
									name: project.name,
									imageUrl: project.iconUrl ?? undefined,
									subtitle: project.summary,
								}
							: undefined
					}
					currentId={id}
					items={projects?.map((item) => ({
						id: item._id,
						name: item.name,
						imageUrl: item.iconUrl ?? undefined,
						subtitle: item.summary,
					}))}
				/>
			}
			id={id}
			moderationNote={project?.moderationReason}
			publicHref={
				project?.status === 'published' &&
				project.moderationStatus === 'approved'
					? `/projects/${project.slug}`
					: undefined
			}
			sections={SECTIONS}
			status={
				project?.status === 'under_review'
					? 'in_review'
					: (project?.status ?? undefined)
			}
			{...props}
		/>
	)
}
