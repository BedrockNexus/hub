import type { ReactNode } from 'react'

export const LISTING_GRID_CLASS =
	'grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4'

export function ListingLayout({
	title,
	action,
	children,
}: {
	title: string
	action?: ReactNode
	children: ReactNode
}) {
	return (
		<main className="container mx-auto flex w-full min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-16 md:px-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-bold text-2xl tracking-tight">{title}</h1>
				{action}
			</div>
			{children}
		</main>
	)
}
