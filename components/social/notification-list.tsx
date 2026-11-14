'use client'

import type { FunctionReturnType } from 'convex/server'
import { formatDistanceToNowStrict } from 'date-fns'
import type { Route } from 'next'
import Link from 'next/link'
import { TargetThumbnail } from '@/components/social/target-row'
import type { api } from '@/convex/_generated/api'
import { cn } from '@/lib/utils'

export type NotificationRow = FunctionReturnType<
	typeof api.functions.social.notifications.listMine
>['page'][number]

function headline(row: NotificationRow) {
	const subject = row.subject
	if (!subject) {
		return null
	}
	switch (row.kind) {
		case 'release':
			return {
				title: `${subject.name}${row.version ? ` ${row.version}` : ''}`,
				detail: `New release${subject.ownerName ? ` from ${subject.ownerName}` : ''}`,
			}
		case 'listing':
			return {
				title: subject.name,
				detail: `New ${subject.kind.toLowerCase()}${subject.ownerName ? ` by ${subject.ownerName}` : ''}`,
			}
		case 'dependency_breaking':
			return {
				title: `${subject.name}${row.version ? ` ${row.version}` : ''}`,
				detail: row.related
					? `Breaking changes. Check ${row.related.name} still works`
					: 'Breaking changes in something you depend on',
			}
		case 'server_offline':
			return {
				title: subject.name,
				detail: 'Your server is not responding',
			}
		case 'server_online':
			return { title: subject.name, detail: 'Your server is back online' }
		default:
			return null
	}
}

/** One notification; unread ones are marked with a dot. */
export function NotificationItem({
	row,
	onOpen,
	compact = false,
}: {
	row: NotificationRow
	onOpen?: (row: NotificationRow) => void
	compact?: boolean
}) {
	const text = headline(row)
	if (!(row.subject && text)) {
		return null
	}
	const unread = row.readAt === undefined
	return (
		<li>
			<Link
				className={cn(
					'flex items-start gap-3 rounded-md p-2.5 transition-colors hover:bg-muted',
					!compact && 'border bg-card p-3',
				)}
				href={row.subject.href as Route}
				onClick={() => onOpen?.(row)}
			>
				<TargetThumbnail
					className={compact ? 'size-9' : undefined}
					summary={row.subject}
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate font-semibold text-sm">
						{text.title}
					</span>
					<span className="block truncate text-muted-foreground text-xs">
						{text.detail} ·{' '}
						{formatDistanceToNowStrict(row.createdAt, {
							addSuffix: true,
						})}
					</span>
				</span>
				{unread ? (
					<span
						aria-label="Unread"
						className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
						role="img"
					/>
				) : null}
			</Link>
		</li>
	)
}
