'use client'

import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'

/** Server-side search box for paged admin lists (debounced). */
export function AdminServerSearch({
	label,
	placeholder,
	onSearch,
}: {
	label: string
	placeholder: string
	onSearch: (value: string) => void
}) {
	const [value, setValue] = useState('')
	const debouncedSearch = useDebouncedCallback(onSearch, 300)

	return (
		<div className="relative max-w-sm">
			<HugeiconsIcon
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				icon={Search01Icon}
			/>
			<Input
				aria-label={label}
				className="pl-9"
				onChange={(event) => {
					setValue(event.target.value)
					debouncedSearch(event.target.value.trim())
				}}
				placeholder={placeholder}
				type="search"
				value={value}
			/>
		</div>
	)
}

/** "Load more" for Convex paginated queries. */
export function AdminLoadMore({
	status,
	onLoadMore,
	loadedCount,
}: {
	status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
	onLoadMore: () => void
	loadedCount: number
}) {
	if (status === 'Exhausted' || status === 'LoadingFirstPage') {
		return (
			<p className="text-center text-muted-foreground text-xs">
				{loadedCount} loaded
			</p>
		)
	}
	return (
		<div className="flex flex-col items-center gap-1">
			<Button
				disabled={status === 'LoadingMore'}
				onClick={onLoadMore}
				variant="outline"
			>
				{status === 'LoadingMore' ? (
					<Spinner className="size-4" />
				) : null}
				Load more
			</Button>
			<p className="text-muted-foreground text-xs">
				{loadedCount} loaded
			</p>
		</div>
	)
}
