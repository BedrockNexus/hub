import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'

export function SectionHeading({
	title,
	description,
	href,
	linkLabel,
}: {
	title: string
	description?: string
	href?: string
	linkLabel?: string
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
			<div className="flex flex-col gap-1.5">
				<h2 className="text-balance font-bold text-[clamp(1.5rem,2.6vw,2rem)] leading-tight tracking-[-0.015em]">
					{title}
				</h2>
				{description ? (
					<p className="max-w-[60ch] text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{href && linkLabel ? (
				<Link
					className="group inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-4 font-medium text-sm transition-colors hover:border-primary/60 hover:text-primary"
					href={href}
				>
					{linkLabel}
					<HugeiconsIcon
						aria-hidden
						className="size-4 transition-transform group-hover:translate-x-0.5"
						icon={ArrowRight02Icon}
					/>
				</Link>
			) : null}
		</div>
	)
}
