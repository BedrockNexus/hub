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
import type { Sidebar } from '@/components/ui/sidebar'
import {
	type EditSection,
	type ListingAction,
	ListingEditSidebar,
} from '@/components/user-dashboard/edit-sidebar/listing-edit-sidebar'
import { ListingSwitcher } from '@/components/user-dashboard/edit-sidebar/listing-switcher'
import { api } from '@/convex/_generated/api'

import { contentDashboard, contentHref } from '@/lib/content-routes'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
	PROJECT_TYPE_PLURAL_LABELS,
	type ProjectType,
} from '@/lib/project-artifacts'

const SECTIONS: readonly EditSection[] = [
	{ id: '', title: 'General', icon: InformationCircleIcon, exactMatch: true },
	{ id: '/description', title: 'Description', icon: TextIcon },
	{ id: '/categories', title: 'Categories', icon: GridIcon },
	{ id: '/links', title: 'Links', icon: Link04Icon },
	{ id: '/license', title: 'License', icon: LicenseIcon },
	{ id: '/gallery', title: 'Gallery', icon: Image02Icon },
	{ id: '/versions', title: 'Versions', icon: Package01Icon },
	{
		id: '/review',
		title: 'Preview & submission',
		icon: CheckmarkCircle01Icon,
	},
]

export function ProjectEditSidebar({
	id,
	type,
	...props
}: React.ComponentProps<typeof Sidebar> & { id: string; type: ProjectType }) {
	const BASE_PATH = contentDashboard(type)
	const router = useRouter()
	const project = useQuery(api.functions.projects.projects.getForEdit, { id })
	const projects = useQuery(api.functions.projects.projects.listMyContent)
	const deleteProject = useMutation(api.functions.projects.projects.remove)

	let action: ListingAction | undefined
	if (
		project?.status === 'draft' &&
		project.moderationStatus !== 'rejected'
	) {
		action = {
			label: 'Review & submit',
			icon: CheckmarkCircle01Icon,
			href: `${BASE_PATH}/${id}/review`,
		}
	}

	return (
		<ListingEditSidebar
			action={action}
			backLabel={`Back to ${PROJECT_TYPE_PLURAL_LABELS[type]}`}
			basePath={BASE_PATH}
			deletion={
				project
					? {
							name: project.name,
							confirmText: project.slug,
							description:
								'This permanently deletes the listing, its versions, files, reviews and gallery.',
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
					addLabel={`Add ${PROJECT_TYPE_LABELS[type]}`}
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
					items={projects
						?.filter(
							(item) => normalizeProjectType(item.type) === type,
						)
						.map((item) => ({
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
					? contentHref(project.type, project.slug)
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
