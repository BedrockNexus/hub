import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageShellProps {
	actions?: ReactNode
	children: ReactNode
	className?: string
	description: string
	eyebrow?: string
	title: string
}

export function PageShell({
	actions,
	children,
	className,
	description,
	eyebrow,
	title,
}: PageShellProps) {
	return (
		<main
			className={cn(
				'container mx-auto w-full flex-1 px-4 py-12 sm:py-16 md:px-6',
				className,
			)}
		>
			<header className="relative flex flex-col gap-7 overflow-hidden border-b pb-10 md:flex-row md:items-end md:justify-between">
				<div className="site-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />
				<div className="max-w-3xl">
					{eyebrow ? (
						<p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase">
							<span className="size-2 bg-primary" />
							{eyebrow}
						</p>
					) : null}
					<h1 className="text-balance font-bold text-4xl md:text-5xl">
						{title}
					</h1>
					<p className="mt-3 max-w-2xl text-base text-muted-foreground leading-7">
						{description}
					</p>
				</div>
				{actions}
			</header>
			<div className="py-10 sm:py-12">{children}</div>
		</main>
	)
}
