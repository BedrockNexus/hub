'use client'

import { Notification01Icon } from '@hugeicons/core-free-icons'
import { useMutation, usePaginatedQuery } from 'convex/react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { NotificationItem } from '@/components/social/notification-list'
import { PagedList } from '@/components/social/paged-list'
import { Button } from '@/components/ui/button'
import { WorkspacePageHeader } from '@/components/workspace-page-header'
import { api } from '@/convex/_generated/api'
import { userFacingError } from '@/lib/user-facing-error'

const PAGE_SIZE = 30

export default function NotificationsPage() {
	const { results, status, loadMore } = usePaginatedQuery(
		api.functions.social.notifications.listMine,
		{},
		{ initialNumItems: PAGE_SIZE },
	)
	const markRead = useMutation(api.functions.social.notifications.markRead)
	const markAllRead = useMutation(
		api.functions.social.notifications.markAllRead,
	)
	const [marking, setMarking] = useState(false)
	const items = results.filter((row) => row.subject !== null)
	const hasUnread = items.some((row) => row.readAt === undefined)

	const onMarkAll = async () => {
		setMarking(true)
		try {
			// Each call marks a batch; keep going until none are left.
			let more = true
			while (more) {
				more = await markAllRead({})
			}
		} catch (error) {
			toast.error(
				userFacingError(error, 'Could not mark notifications read'),
			)
		} finally {
			setMarking(false)
		}
	}

	return (
		<div className="space-y-6">
			<WorkspacePageHeader
				actions={
					<div className="flex gap-2">
						<Button
							nativeButton={false}
							render={(props) => (
								<Link
									{...props}
									href={
										'/dashboard/settings/notifications' as Route
									}
								/>
							)}
							variant="outline"
						>
							Settings
						</Button>
						{hasUnread ? (
							<Button
								disabled={marking}
								onClick={onMarkAll}
								type="button"
							>
								Mark all read
							</Button>
						) : null}
					</div>
				}
				description="New releases and listings from what you follow, and alerts about your servers. Kept for 90 days."
				title="Notifications"
			/>
			<PagedList
				empty={{
					icon: Notification01Icon,
					title: 'No notifications',
					description:
						'Follow creators, servers and packs, and their new releases will show up here.',
				}}
				items={items}
				loadMore={loadMore}
				pageSize={PAGE_SIZE}
				renderItem={(row) => (
					<NotificationItem
						key={row._id}
						onOpen={(opened) => {
							if (opened.readAt === undefined) {
								markRead({
									notificationIds: [opened._id],
								}).catch(() => {
									// Stays unread; opening it again retries.
								})
							}
						}}
						row={row}
					/>
				)}
				status={status}
			/>
		</div>
	)
}
