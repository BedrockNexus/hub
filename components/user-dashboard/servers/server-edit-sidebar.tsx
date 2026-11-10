'use client'

import {
	Analytics01Icon,
	Image02Icon,
	InformationCircleIcon,
	Link04Icon,
	PaintBoardIcon,
	TextIcon,
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
import { serverHref, serverReference } from '@/lib/server-routes'
import { userFacingError } from '@/lib/user-facing-error'

const BASE_PATH = '/dashboard/servers'

const SECTIONS: readonly EditSection[] = [
	{
		id: '',
		title: 'General',
		icon: InformationCircleIcon,
		exactMatch: true,
		group: 'Listing',
	},
	{
		id: '/description',
		title: 'Description',
		icon: TextIcon,
		group: 'Listing',
	},
	{
		id: '/branding',
		title: 'Branding',
		icon: PaintBoardIcon,
		group: 'Listing',
	},
	{
		id: '/gallery',
		title: 'Gallery',
		icon: Image02Icon,
		group: 'Listing',
	},
	{
		id: '/links',
		title: 'Links',
		icon: Link04Icon,
		group: 'Listing',
	},
	{
		id: '/connection',
		title: 'Connection',
		icon: Wifi01Icon,
		group: 'Server',
	},
	{
		id: '/analytics',
		title: 'Analytics',
		icon: Analytics01Icon,
		group: 'Insights',
	},
]

function errorMessage(error: unknown, fallback: string) {
	return userFacingError(error, fallback)
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
					? `${server.name} submitted for review`
					: `${server.name} moved to draft`,
			)
		} catch (error) {
			toast.error(errorMessage(error, 'Failed to update server status'))
		}
	}

	// Submitting is done from the checklist beside each page.
	let action: ListingAction | undefined
	if (
		server?.status === 'published' &&
		server.submissionStatus !== 'pending' &&
		!server.draftChangesJson
	) {
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
								'This permanently deletes the server listing, its reviews, gallery and stats. Recorded submission history and its images are retained.',
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
						id: serverReference(item),
						name: item.name,
						imageUrl: item.logoUrl ?? undefined,
						subtitle: item.ipAddress,
					}))}
				/>
			}
			id={id}
			moderationNote={
				server?.submissionReason ?? server?.moderationReason
			}
			publicHref={
				server?.status === 'published' ? serverHref(server) : undefined
			}
			sections={SECTIONS}
			status={
				server?.submissionStatus === 'pending' ||
				server?.status === 'under_review'
					? 'in_review'
					: (server?.status ?? undefined)
			}
			{...props}
		/>
	)
}
