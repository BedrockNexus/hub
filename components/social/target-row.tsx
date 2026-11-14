import {
	CubeIcon,
	Folder01Icon,
	OfficeIcon,
	PaintBrush01Icon,
	PlugSocketIcon,
	ServerStack03Icon,
	UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** What the backend's lib/targetSummaries.ts returns. */
export interface TargetSummary {
	targetType:
		| 'user'
		| 'organization'
		| 'project'
		| 'server'
		| 'plugin'
		| 'collection'
	targetId: string
	kind: string
	name: string
	href: string
	imageUrl?: string
	ownerName?: string
}

function fallbackIcon(summary: TargetSummary) {
	switch (summary.targetType) {
		case 'server':
			return ServerStack03Icon
		case 'plugin':
			return PlugSocketIcon
		case 'user':
			return UserIcon
		case 'organization':
			return OfficeIcon
		case 'collection':
			return Folder01Icon
		default:
			return summary.kind === 'Resource pack'
				? PaintBrush01Icon
				: CubeIcon
	}
}

export function TargetThumbnail({
	summary,
	className,
}: {
	summary: TargetSummary
	className?: string
}) {
	const round = summary.targetType === 'user'
	return (
		<div
			className={cn(
				'relative grid size-11 shrink-0 place-items-center overflow-hidden bg-stone text-white',
				round ? 'rounded-full' : 'rounded-md',
				className,
			)}
		>
			{summary.imageUrl ? (
				<Image
					alt=""
					className="object-cover"
					fill
					sizes="44px"
					src={summary.imageUrl}
				/>
			) : (
				<HugeiconsIcon
					aria-hidden
					className="size-5"
					icon={fallbackIcon(summary)}
				/>
			)}
		</div>
	)
}

/** One followed, saved or collected item, linking to its page. */
export function TargetRow({
	summary,
	detail,
	actions,
}: {
	summary: TargetSummary
	/** A second line under the name, e.g. a collection note. */
	detail?: ReactNode
	actions?: ReactNode
}) {
	return (
		<li className="flex items-center gap-3 rounded-md border bg-card p-3">
			<TargetThumbnail summary={summary} />
			<div className="min-w-0 flex-1">
				<Link
					className="block truncate font-semibold hover:text-ember-text"
					href={summary.href as Route}
				>
					{summary.name}
				</Link>
				<p className="truncate text-muted-foreground text-sm">
					{summary.kind}
					{summary.ownerName ? ` by ${summary.ownerName}` : ''}
				</p>
				{detail ? (
					<p className="mt-1 text-muted-foreground text-sm">
						{detail}
					</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-2">
					{actions}
				</div>
			) : null}
		</li>
	)
}
