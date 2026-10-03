import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'

export function SectionHeading({
	title,
	href,
	linkLabel,
}: {
	title: string
	href?: string
	linkLabel?: string
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<h2 className="font-bold text-[clamp(1.625rem,3vw,2.25rem)] leading-tight">
				{title}
			</h2>
			{href && linkLabel ? (
				<Link
					className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ember-text hover:text-foreground"
					href={href}
				>
					{linkLabel}
					<HugeiconsIcon
						aria-hidden
						className="size-4"
						icon={ArrowRight02Icon}
					/>
				</Link>
			) : null}
		</div>
	)
}
