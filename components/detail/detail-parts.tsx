import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type IconType = NonNullable<ComponentProps<typeof HugeiconsIcon>['icon']>

/** Tab strip for detail pages; each tab is its own URL. */
export function DetailTabs({
	tabs,
	active,
	label,
}: {
	tabs: { value: string; label: string; href: string; count?: number }[]
	active: string
	label: string
}) {
	return (
		<nav
			aria-label={label}
			className="flex flex-wrap gap-x-7 gap-y-1 border-b"
		>
			{tabs.map((tab) => {
				const isActive = tab.value === active
				return (
					<Link
						aria-current={isActive ? 'page' : undefined}
						className={cn(
							'-mb-px inline-flex min-h-12 items-center gap-1.5 border-b-[3px] px-1 font-bold font-display text-[15px] uppercase tracking-wide transition-colors',
							isActive
								? 'border-primary text-foreground'
								: 'border-transparent text-muted-foreground hover:text-foreground',
						)}
						href={tab.href}
						key={tab.value}
						scroll={false}
					>
						{tab.label}
						{tab.count ? (
							<span className="rounded-sm bg-muted px-1.5 font-mono text-muted-foreground text-xs">
								{tab.count}
							</span>
						) : null}
					</Link>
				)
			})}
		</nav>
	)
}

/** Sidebar card with a small uppercase heading. */
export function SideCard({
	title,
	children,
	className,
}: {
	title: string
	children: ReactNode
	className?: string
}) {
	return (
		<section
			className={cn(
				'flex flex-col gap-3 rounded-md border bg-card p-5',
				className,
			)}
		>
			<h2 className="font-bold font-display text-[13px] text-muted-foreground uppercase tracking-[0.1em]">
				{title}
			</h2>
			{children}
		</section>
	)
}

export function KeyValue({
	label,
	children,
	mono = false,
}: {
	label: string
	children: ReactNode
	mono?: boolean
}) {
	return (
		<div className="flex justify-between gap-3 border-b border-dashed py-1.5 text-sm last:border-b-0">
			<dt className="text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					'min-w-0 truncate text-right',
					mono ? 'font-mono text-[13px]' : 'font-medium',
				)}
			>
				{children}
			</dd>
		</div>
	)
}

export function ExternalLinkRow({
	href,
	label,
	icon,
}: {
	href: string
	label: string
	icon: NonNullable<ComponentProps<typeof HugeiconsIcon>['icon']>
}) {
	return (
		<a
			className="flex min-h-11 items-center gap-2.5 rounded-sm border bg-background px-3 font-medium transition-colors hover:border-ember"
			href={href}
			rel="noopener noreferrer"
			target="_blank"
		>
			<HugeiconsIcon aria-hidden className="size-4.5" icon={icon} />
			<span className="flex-1">{label}</span>
			<HugeiconsIcon
				aria-hidden
				className="size-3.5 text-muted-foreground"
				icon={ArrowUpRight01Icon}
			/>
		</a>
	)
}

export function ensureHttpUrl(url: string) {
	return url.startsWith('http://') || url.startsWith('https://')
		? url
		: `https://${url}`
}
