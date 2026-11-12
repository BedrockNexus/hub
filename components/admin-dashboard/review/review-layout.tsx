'use client'

import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMinute } from '@/hooks/use-minute'
import type { ReviewTab } from '@/lib/admin-review-navigation'
import { OVERDUE_AFTER, waitingTime } from '@/lib/moderation-time'
import { cn } from '@/lib/utils'

export interface ReviewTabItem {
	id: ReviewTab
	label: string
	count?: number
}

/** A short fact next to the title, such as "New listing" or the wait. */
export function ReviewChip({
	children,
	tone = 'default',
}: {
	children: ReactNode
	tone?: 'default' | 'warn'
}) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-[13px]',
				tone === 'warn'
					? 'bg-primary/15 font-mono text-primary'
					: 'bg-muted text-foreground',
			)}
		>
			{children}
		</span>
	)
}

/** "Waiting 2d 3h", marked once it is over a day. */
export function WaitingChip({ since }: { since?: number }) {
	const now = useMinute()
	if (!since) {
		return null
	}
	const waited = now - since
	return (
		<ReviewChip tone={waited >= OVERDUE_AFTER ? 'warn' : 'default'}>
			Waiting {waitingTime(waited)}
		</ReviewChip>
	)
}

/** The listing's icon, or its first letter. */
export function ReviewIcon({
	src,
	name,
	size = 56,
}: {
	src?: string
	name: string
	size?: number
}) {
	if (src) {
		return (
			<Image
				alt=""
				className="shrink-0 rounded-lg border object-cover"
				height={size}
				src={src}
				style={{ width: size, height: size }}
				width={size}
			/>
		)
	}
	return (
		<span
			aria-hidden
			className="flex shrink-0 items-center justify-center rounded-lg bg-muted font-bold font-display text-muted-foreground shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)]"
			style={{ width: size, height: size, fontSize: size * 0.4 }}
		>
			{name.charAt(0).toUpperCase()}
		</span>
	)
}

/**
 * One submission under review: what it is at the top, the material in tabs,
 * and the claim and decision always visible on the right (`rail`).
 */
export function ReviewLayout({
	back,
	iconUrl,
	name,
	title,
	meta,
	actions,
	tabs,
	activeTab,
	onTabChange,
	rail,
	children,
}: {
	back: { href: string; label: string }
	iconUrl?: string
	name: string
	/** Defaults to the name. */
	title?: ReactNode
	/** Chips and facts under the title. */
	meta: ReactNode
	/** Links such as the public page or a download. */
	actions?: ReactNode
	tabs?: ReviewTabItem[]
	activeTab?: ReviewTab
	onTabChange?: (tab: ReviewTab) => void
	rail: ReactNode
	children: ReactNode
}) {
	const content =
		tabs && activeTab ? (
			<Tabs
				className="flex-col gap-0"
				onValueChange={(value) => onTabChange?.(value as ReviewTab)}
				value={activeTab}
			>
				<TabsList
					className="w-full justify-start gap-1 border-b"
					variant="line"
				>
					{tabs.map((tab) => (
						<TabsTrigger
							className="h-11 flex-none rounded-none px-3.5 data-active:text-foreground data-active:shadow-[inset_0_-2px_0_var(--primary)]!"
							key={tab.id}
							value={tab.id}
						>
							{tab.label}
							{tab.count ? (
								<span className="rounded-full bg-muted px-1.5 text-muted-foreground text-xs">
									{tab.count}
								</span>
							) : null}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent className="pt-5" value={activeTab}>
					{children}
				</TabsContent>
			</Tabs>
		) : (
			children
		)
	return (
		<div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
			<Link
				className="inline-flex min-h-8 items-center gap-1.5 self-start text-muted-foreground text-sm hover:text-foreground"
				href={back.href as Route}
			>
				<HugeiconsIcon aria-hidden icon={ArrowLeft02Icon} size={16} />
				{back.label}
			</Link>
			<header className="flex flex-wrap items-center gap-4">
				<ReviewIcon name={name} src={iconUrl} />
				<div className="flex min-w-0 flex-col gap-1.5">
					<h1 className="font-bold font-display text-[1.75rem] leading-tight">
						{title ?? name}
					</h1>
					<div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-muted-foreground text-sm">
						{meta}
					</div>
				</div>
				{actions ? (
					<div className="flex flex-wrap gap-2 sm:ml-auto">
						{actions}
					</div>
				) : null}
			</header>
			<div className="flex flex-wrap items-start gap-7">
				<div className="min-w-0 flex-[999_1_560px]">{content}</div>
				<aside
					aria-label="Review decision"
					className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 lg:sticky lg:top-20 lg:max-w-[360px]"
				>
					{rail}
				</aside>
			</div>
		</div>
	)
}

/** A titled block in a review tab. */
export function ReviewSection({
	title,
	badge,
	aside,
	children,
	className,
}: {
	title: ReactNode
	badge?: ReactNode
	aside?: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<section className={cn('rounded-lg border bg-card', className)}>
			<div className="flex flex-wrap items-center justify-between gap-2 border-b px-4.5 py-3.5">
				<h2 className="flex items-center gap-2.5 font-semibold text-[15px]">
					{title}
					{badge ? (
						<span className="rounded bg-muted px-2 py-px font-normal text-muted-foreground text-xs">
							{badge}
						</span>
					) : null}
				</h2>
				{aside}
			</div>
			{children}
		</section>
	)
}
