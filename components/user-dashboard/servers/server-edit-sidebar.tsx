'use client'

import {
	GridIcon,
	Image02Icon,
	InformationCircleIcon,
	Link04Icon,
	PaintBoardIcon,
	TextIcon,
	ViewIcon,
	ViewOffSlashIcon,
	Wifi01Icon,
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

const BASE_PATH = '/dashboard/servers'

const SECTIONS: readonly EditSection[] = [
	{ id: '', title: 'General', icon: InformationCircleIcon, exactMatch: true },
	{ id: '/description', title: 'Description', icon: TextIcon },
	{ id: '/connection', title: 'Connection', icon: Wifi01Icon },
	{ id: '/branding', title: 'Branding', icon: PaintBoardIcon },
	{ id: '/categories', title: 'Categories', icon: GridIcon },
	{ id: '/links', title: 'Links', icon: Link04Icon },
	{ id: '/gallery', title: 'Gallery', icon: Image02Icon },
]

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback
}

export function ServerEditSidebar({
	id,
	...props
}: React.ComponentProps<typeof Sidebar> & { id: string }) {
	const router = useRouter()
	const server = useQuery(api.functions.servers.servers.getForEdit, { id })
	const servers = useQuery(api.functions.servers.servers.listMyServers)
	const deleteServer = useMutation(api.functions.servers.servers.remove)
	const updateServer = useMutation(api.functions.servers.servers.update)

	const setStatus = async (status: 'draft' | 'published') => {
		if (!server) {
			return
		}
		try {
			await updateServer({ id: server._id, status })
			toast.success(
				status === 'published'
					? `${server.name} is now published`
					: `${server.name} moved to draft`,
			)
		} catch (error) {
			toast.error(errorMessage(error, 'Failed to update server status'))
		}
	}

	let action: ListingAction | undefined
	if (server?.status === 'draft') {
		action = {
			label: 'Publish',
			icon: ViewIcon,
			onRun: () => setStatus('published'),
		}
	} else if (server?.status === 'published') {
		action = {
			label: 'Move to draft',
			icon: ViewOffSlashIcon,
			onRun: () => setStatus('draft'),
		}
	}

	return (
		<ListingEditSidebar
			action={action}
			backLabel="Back to Servers"
			basePath={BASE_PATH}
			deletion={
				server
					? {
							name: server.name,
							confirmText: server.slug,
							description:
								'This permanently deletes the server, its reviews, gallery and stats.',
							onDelete: async () => {
								await deleteServer({ id: server._id })
								router.push(BASE_PATH)
							},
						}
					: undefined
			}
			header={
				<ListingSwitcher
					addHref={`${BASE_PATH}/add`}
					addLabel="Add Server"
					basePath={BASE_PATH}
					current={
						server
							? {
									name: server.name,
									imageUrl: server.logoUrl ?? undefined,
									subtitle: server.ipAddress,
								}
							: undefined
					}
					currentId={id}
					items={servers?.map((item) => ({
						id: item._id,
						name: item.name,
						imageUrl: item.logoUrl ?? undefined,
						subtitle: item.ipAddress,
					}))}
				/>
			}
			id={id}
			moderationNote={server?.moderationReason}
			publicHref={
				server?.status === 'published'
					? `/servers/${server.slug}`
					: undefined
			}
			sections={SECTIONS}
			status={
				server?.status === 'under_review'
					? 'in_review'
					: (server?.status ?? undefined)
			}
			{...props}
		/>
	)
}
