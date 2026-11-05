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
	WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import type { Route } from 'next'
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
import {
	creatorListingState,
	creatorSidebarStatus,
} from '@/lib/creator-listing-state'
import { createPluginDashboardId } from '@/lib/plugins/plugin-dashboard-id'

const BASE_PATH = '/dashboard/plugins'

const SECTIONS: readonly EditSection[] = [
	{ id: '', title: 'General', icon: InformationCircleIcon, exactMatch: true },
	{ id: '/description', title: 'Description', icon: TextIcon },
	{ id: '/categories', title: 'Categories', icon: GridIcon },
	{ id: '/links', title: 'Links', icon: Link04Icon },
	{ id: '/license', title: 'License', icon: LicenseIcon },
	{ id: '/gallery', title: 'Gallery', icon: Image02Icon },
	{ id: '/workflow', title: 'Workflow', icon: WorkflowSquare01Icon },
	{ id: '/versions', title: 'Versions', icon: Package01Icon },
	{
		id: '/review',
		title: 'Preview & submission',
		icon: CheckmarkCircle01Icon,
	},
]

/** `id` is the plugin's dashboard id from the URL (lib/plugins/plugin-dashboard-id). */
export function PluginEditSidebar({
	id,
	...props
}: React.ComponentProps<typeof Sidebar> & { id: string }) {
	const router = useRouter()
	const auth = useConvexAuth()
	const draftId = useQuery(
		api.functions.plugins.publishing.model.resolveMine,
		auth.isAuthenticated ? { reference: id } : 'skip',
	)
	const plugin = useQuery(
		api.functions.plugins.publishing.model.getMine,
		draftId ? { draftId } : 'skip',
	)
	const plugins = useQuery(
		api.functions.plugins.publishing.model.listMine,
		auth.isAuthenticated ? {} : 'skip',
	)
	const deletePlugin = useMutation(
		api.functions.plugins.deletion.deleteProject,
	)

	const input = { ...plugin?.project, locked: plugin?.locked }
	const state = creatorListingState(input)
	const status = plugin ? creatorSidebarStatus(input) : undefined
	const action: ListingAction | undefined =
		plugin && state.canSubmit
			? {
					label: 'Review & submit',
					icon: CheckmarkCircle01Icon,
					href: `${BASE_PATH}/${id}/review`,
				}
			: undefined

	return (
		<ListingEditSidebar
			action={action}
			backLabel="Back to Plugins"
			basePath={BASE_PATH}
			deletion={
				plugin && !state.locked
					? {
							name: plugin.draft.name,
							confirmText: plugin.draft.slug,
							description:
								'This permanently removes the plugin, its versions, files, reviews, gallery and download history from BedrockNexus. Recorded submission history and its images are retained. Your GitHub repository and its releases are not changed.',
							onDelete: async (confirmation) => {
								await deletePlugin({
									draftId: plugin.draft._id,
									confirmSlug: confirmation,
								})
								router.push(BASE_PATH as Route)
							},
						}
					: undefined
			}
			header={
				<ListingSwitcher
					addHref={`${BASE_PATH}/new`}
					addLabel="Add Plugin"
					basePath={BASE_PATH}
					current={
						plugin
							? {
									name: plugin.draft.name,
									imageUrl: plugin.draft.iconUrl,
									subtitle:
										plugin.softwareName ??
										plugin.repository.fullName,
								}
							: undefined
					}
					currentId={id}
					items={plugins?.map((entry) => ({
						id: createPluginDashboardId(
							entry.repository.githubRepositoryId,
						),
						name: entry.draft.name,
						imageUrl: entry.draft.iconUrl,
						subtitle: entry.repository.fullName,
					}))}
				/>
			}
			id={id}
			moderationNote={plugin?.moderationNote}
			publicHref={
				state.published && plugin
					? `/plugins/${createPluginDashboardId(plugin.repository.githubRepositoryId)}`
					: undefined
			}
			sections={SECTIONS}
			status={status}
			{...props}
		/>
	)
}
