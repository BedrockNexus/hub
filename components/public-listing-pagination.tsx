'use client'

import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'

interface PublicListingPaginationProps {
	cursor: number
	hasMore: boolean
	onPageChange: (cursor: number) => void
	pageSize: number
	totalCount: number
}

export function PublicListingPagination({
	cursor,
	hasMore,
	onPageChange,
	pageSize,
	totalCount,
}: PublicListingPaginationProps) {
	if (totalCount <= pageSize) {
		return null
	}

	const currentPage = Math.floor(cursor / pageSize) + 1
	const totalPages = Math.ceil(totalCount / pageSize)
	const rangeStart = cursor + 1
	const rangeEnd = Math.min(cursor + pageSize, totalCount)

	return (
		<nav
			aria-label="Listing pagination"
			className="mt-8 flex flex-col items-center gap-3 border-t pt-6 sm:flex-row sm:justify-between"
		>
			<p className="text-muted-foreground text-sm tabular-nums">
				Showing {rangeStart}-{rangeEnd} of {totalCount}
			</p>
			<div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
				<Button
					disabled={cursor === 0}
					onClick={() => onPageChange(Math.max(0, cursor - pageSize))}
					size="sm"
					variant="outline"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} />
					<span className="xs:inline hidden">Previous</span>
				</Button>
				<span className="min-w-24 text-center text-muted-foreground text-sm tabular-nums">
					Page {currentPage} of {totalPages}
				</span>
				<Button
					disabled={!hasMore}
					onClick={() => onPageChange(cursor + pageSize)}
					size="sm"
					variant="outline"
				>
					<span className="xs:inline hidden">Next</span>
					<HugeiconsIcon icon={ArrowRight01Icon} />
				</Button>
			</div>
		</nav>
	)
}
