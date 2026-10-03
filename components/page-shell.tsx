import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageShellProps {
	actions?: ReactNode
	/** Content under the title inside the header band, e.g. a search field. */
	headerContent?: ReactNode
	breadcrumb?: { href: string; label: string }[]
	children: ReactNode
	className?: string
	description: ReactNode
	title: string
}

/** Listing page frame: a grid-backed header band, then the page content. */
export function PageShell({
	actions,
	headerContent,
	breadcrumb,
	children,
	className,
	description,
	title,
}: PageShellProps) {
	return (
		<main className="flex flex-1 flex-col">
			<header className="border-b bg-surface-sunken">
				<div className="container mx-auto flex flex-col gap-4.5 px-4 pt-10 pb-8 md:px-6">
					{breadcrumb ? (
						<nav
							aria-label="Breadcrumb"
							className="flex gap-2 text-sm"
						>
							{breadcrumb.map((item) => (
								<span className="flex gap-2" key={item.href}>
									<Link
										className="text-muted-foreground hover:text-foreground"
										href={item.href}
									>
										{item.label}
									</Link>
									<span
										aria-hidden
										className="text-muted-foreground"
									>
										/
									</span>
								</span>
							))}
							<span aria-current="page">{title}</span>
						</nav>
					) : null}
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div className="flex flex-col gap-2">
							<h1 className="text-balance font-bold text-[clamp(2rem,4vw,3rem)] leading-none">
								{title}
							</h1>
							<p className="max-w-2xl text-[17px] text-muted-foreground">
								{description}
							</p>
						</div>
						{actions}
					</div>
					{headerContent}
				</div>
			</header>
			<div
				className={cn(
					'container mx-auto w-full px-4 pt-7 pb-18 md:px-6',
					className,
				)}
			>
				{children}
			</div>
		</main>
	)
}
