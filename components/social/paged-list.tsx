'use client'

import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Filter chips above a list, e.g. All / Add-ons / Servers. */
export function FilterChips<Value extends string>({
	options,
	value,
	onChange,
	label,
}: {
	options: { value: Value; label: string }[]
	value: Value
	onChange: (value: Value) => void
	label: string
}) {
	return (
		<fieldset className="flex flex-wrap gap-2">
			<legend className="sr-only">{label}</legend>
			{options.map((option) => (
				<Button
					aria-pressed={option.value === value}
					key={option.value}
					onClick={() => onChange(option.value)}
					size="sm"
					type="button"
					variant={option.value === value ? 'secondary' : 'outline'}
				>
					{option.label}
				</Button>
			))}
		</fieldset>
	)
}

type PaginationStatus =
	| 'LoadingFirstPage'
	| 'CanLoadMore'
	| 'LoadingMore'
	| 'Exhausted'

/**
 * A paginated list with loading, empty and "Load more" states. Rows that came
 * back null (no longer public) are skipped by the caller before `items`.
 */
export function PagedList<Item>({
	items,
	status,
	loadMore,
	pageSize,
	renderItem,
	empty,
	className,
}: {
	items: Item[]
	status: PaginationStatus
	loadMore: (count: number) => void
	pageSize: number
	renderItem: (item: Item) => ReactNode
	empty: { icon: IconSvgElement; title: string; description: string }
	className?: string
}) {
	if (status === 'LoadingFirstPage') {
		return (
			<div className="space-y-2">
				<Skeleton className="h-16" />
				<Skeleton className="h-16" />
				<Skeleton className="h-16" />
			</div>
		)
	}
	if (items.length === 0 && status === 'Exhausted') {
		return (
			<Empty className="border border-dashed py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={empty.icon} />
					</EmptyMedia>
					<EmptyTitle>{empty.title}</EmptyTitle>
					<EmptyDescription>{empty.description}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}
	return (
		<div className="space-y-4">
			<ul className={cn('space-y-2', className)}>
				{items.map(renderItem)}
			</ul>
			{status === 'CanLoadMore' || status === 'LoadingMore' ? (
				<div className="flex justify-center">
					<Button
						disabled={status === 'LoadingMore'}
						onClick={() => loadMore(pageSize)}
						type="button"
						variant="outline"
					>
						{status === 'LoadingMore' ? 'Loading…' : 'Load more'}
					</Button>
				</div>
			) : null}
		</div>
	)
}
