'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * The layout of a listing's settings pages: one readable column, with the
 * checklist and Submit beside it on wide screens (`rail`) or above the page
 * on narrower ones (`strip`). Preview & submission has its own checklist, so
 * neither is shown there.
 */
export function ListingEditFrame({
	rail,
	strip,
	children,
}: {
	rail: ReactNode
	strip: ReactNode
	children: ReactNode
}) {
	const pathname = usePathname()
	const showPanel = !pathname.endsWith('/review')
	return (
		<div className="flex w-full min-w-0 items-start gap-8">
			<div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
				{showPanel ? (
					<div className="empty:hidden xl:hidden">{strip}</div>
				) : null}
				{children}
			</div>
			{showPanel ? (
				<aside
					aria-label="Listing checklist"
					className="sticky top-22 hidden shrink-0 xl:not-empty:block"
				>
					{rail}
				</aside>
			) : null}
		</div>
	)
}
