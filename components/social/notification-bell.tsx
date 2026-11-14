'use client'

import { Notification01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	NotificationItem,
	type NotificationRow,
} from '@/components/social/notification-list'
import { Button } from '@/components/ui/button'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const PREVIEW_COUNT = 8

function PreviewBody({
	status,
	rows,
	onOpen,
}: {
	status: string
	rows: NotificationRow[]
	onOpen: (row: NotificationRow) => void
}) {
	if (status === 'LoadingFirstPage') {
		return (
			<div className="space-y-2">
				<Skeleton className="h-12" />
				<Skeleton className="h-12" />
			</div>
		)
	}
	if (rows.length === 0) {
		return (
			<p className="py-6 text-center text-muted-foreground text-sm">
				Nothing yet. Follow creators, servers and packs to hear about
				new releases.
			</p>
		)
	}
	return (
		<ul className="-mx-2 max-h-96 space-y-0.5 overflow-y-auto">
			{rows.map((row) => (
				<NotificationItem
					compact
					key={row._id}
					onOpen={onOpen}
					row={row}
				/>
			))}
		</ul>
	)
}

function NotificationPreview({ onNavigate }: { onNavigate: () => void }) {
	const { results, status } = usePaginatedQuery(
		api.functions.social.notifications.listMine,
		{},
		{ initialNumItems: PREVIEW_COUNT },
	)
	const markRead = useMutation(api.functions.social.notifications.markRead)
	const markAllRead = useMutation(
		api.functions.social.notifications.markAllRead,
	)
	const visible = results.filter((row) => row.subject !== null)
	const hasUnread = visible.some((row) => row.readAt === undefined)

	const open = (row: NotificationRow) => {
		if (row.readAt === undefined) {
			markRead({ notificationIds: [row._id] }).catch(() => {
				// Stays unread; the next open tries again.
			})
		}
		onNavigate()
	}

	return (
		<>
			<div className="flex items-center justify-between gap-2">
				<p className="font-display font-semibold">Notifications</p>
				{hasUnread ? (
					<Button
						onClick={() => {
							markAllRead({}).catch(() => {
								toast.error('Could not mark notifications read')
							})
						}}
						size="xs"
						type="button"
						variant="ghost"
					>
						Mark all read
					</Button>
				) : null}
			</div>
			<PreviewBody onOpen={open} rows={visible} status={status} />
			<Link
				className="border-t pt-3 text-center font-medium text-ember-text text-sm hover:text-foreground"
				href="/dashboard/notifications"
				onClick={onNavigate}
			>
				See all notifications
			</Link>
		</>
	)
}

/** Header bell with the unread count; shown only when signed in. */
export function NotificationBell({ className }: { className?: string }) {
	const { data: session } = authClient.useSession()
	const unread = useQuery(
		api.functions.social.notifications.unreadCount,
		session?.user ? {} : 'skip',
	)
	const [open, setOpen] = useState(false)
	if (!session?.user) {
		return null
	}
	const count = unread ?? 0
	const label =
		count === 0
			? 'Notifications'
			: `Notifications, ${count >= 100 ? 'more than 99' : count} unread`

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				render={
					<Button
						aria-label={label}
						className={cn('relative', className)}
						size="icon-lg"
						type="button"
						variant="ghost"
					/>
				}
			>
				<HugeiconsIcon icon={Notification01Icon} />
				{count > 0 ? (
					<span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono font-semibold text-[10px] text-primary-foreground leading-none">
						{count >= 100 ? '99+' : count}
					</span>
				) : null}
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[min(24rem,calc(100vw-2rem))]"
			>
				{open ? (
					<NotificationPreview onNavigate={() => setOpen(false)} />
				) : null}
			</PopoverContent>
		</Popover>
	)
}
