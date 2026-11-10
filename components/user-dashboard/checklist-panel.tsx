'use client'

import { Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useId, useState } from 'react'
import type { ListingCheck } from '@/components/user-dashboard/listing-submission-checklist'
import { cn } from '@/lib/utils'

export type PanelVariant = 'rail' | 'strip'

/** Where a check is done, as a path, and whether that is the current page. */
function checkHref(basePath: string, section: string) {
	return `${basePath}${section}`
}

function isCurrent(pathname: string, basePath: string, section: string) {
	const path = section.startsWith('#') ? '' : section
	return pathname === `${basePath}${path}`
}

function Progress({ done, total }: { done: number; total: number }) {
	const percent = total ? Math.round((done / total) * 100) : 100
	return (
		<div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
			<div
				className="h-full rounded-full bg-primary transition-[width] duration-300"
				style={{ width: `${percent}%` }}
			/>
		</div>
	)
}

function CheckList({
	checks,
	basePath,
	id,
}: {
	checks: ListingCheck[]
	basePath: string
	id?: string
}) {
	const pathname = usePathname()
	return (
		<ul id={id}>
			{checks.map((check) => {
				const current =
					!check.complete &&
					isCurrent(pathname, basePath, check.section)
				return (
					<li
						className={cn(
							'flex min-h-12 items-center gap-3 border-t px-4.5 py-1.5',
							current &&
								'bg-muted/50 shadow-[inset_2px_0_0_var(--primary)]',
						)}
						key={check.label}
					>
						<span
							aria-hidden
							className={cn(
								'flex size-5 shrink-0 items-center justify-center rounded-full',
								check.complete
									? 'bg-primary text-primary-foreground'
									: 'border-[1.5px] border-muted-foreground/50',
							)}
						>
							{check.complete ? (
								<HugeiconsIcon
									icon={Tick02Icon}
									size={13}
									strokeWidth={2.5}
								/>
							) : null}
						</span>
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="sr-only">
								{check.complete ? 'Done: ' : 'To do: '}
							</span>
							<Link
								aria-current={current ? 'step' : undefined}
								className={cn(
									'w-fit text-sm',
									check.complete
										? 'text-muted-foreground line-through decoration-muted-foreground/50'
										: 'font-medium hover:text-primary',
								)}
								href={
									checkHref(basePath, check.section) as Route
								}
							>
								{check.label}
							</Link>
							<span className="text-muted-foreground text-xs">
								{check.required ? 'Required' : 'Recommended'}
								{current ? ' · you are here' : ''}
							</span>
						</span>
					</li>
				)
			})}
		</ul>
	)
}

/**
 * What a draft still needs before it can be submitted, and the Submit
 * button. Shown on every settings page of a listing: as a sidebar on the
 * right on wide screens (`rail`), as a bar above the page that opens into the
 * full list on narrower ones (`strip`).
 */
export function ChecklistPanel({
	variant,
	checks,
	basePath,
	actions,
	title = 'Finish your listing',
}: {
	variant: PanelVariant
	checks: ListingCheck[]
	basePath: string
	/** Submit (and Preview) controls. */
	actions: ReactNode
	title?: string
}) {
	const headingId = useId()
	const listId = useId()
	const [open, setOpen] = useState(false)
	const done = checks.filter((check) => check.complete).length
	const requiredLeft = checks.filter(
		(check) => check.required && !check.complete,
	).length
	const status =
		requiredLeft > 0
			? `${requiredLeft} required ${requiredLeft === 1 ? 'step' : 'steps'} left`
			: 'Ready to submit'

	if (variant === 'strip') {
		return (
			<section
				aria-labelledby={headingId}
				className="overflow-hidden rounded-lg border border-foreground/15 bg-card"
			>
				<button
					aria-controls={listId}
					aria-expanded={open}
					className="flex min-h-14 w-full items-center gap-4 px-4.5 py-3 text-left focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2"
					onClick={() => setOpen((value) => !value)}
					type="button"
				>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="font-bold font-display" id={headingId}>
							{title}
						</span>
						<span className="text-muted-foreground text-sm">
							{done} of {checks.length} done · {status}
						</span>
					</span>
					<span className="hidden w-32 sm:block">
						<Progress done={done} total={checks.length} />
					</span>
					<span className="shrink-0 font-medium text-primary text-sm">
						{open ? 'Hide steps' : 'Show steps'}
					</span>
				</button>
				{open ? (
					<>
						<CheckList
							basePath={basePath}
							checks={checks}
							id={listId}
						/>
						<div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4.5 py-3">
							{actions}
						</div>
					</>
				) : null}
			</section>
		)
	}

	return (
		<section
			aria-labelledby={headingId}
			className="w-[300px] overflow-hidden rounded-lg border border-foreground/15 bg-card"
		>
			<div className="space-y-1 px-4.5 pt-4.5 pb-3">
				<h2
					className="font-bold font-display text-[1.05rem]"
					id={headingId}
				>
					{title}
				</h2>
				<p className="text-muted-foreground text-sm">
					{done} of {checks.length} done
				</p>
			</div>
			<div className="px-4.5">
				<Progress done={done} total={checks.length} />
			</div>
			<div className="mt-3">
				<CheckList basePath={basePath} checks={checks} />
			</div>
			<div className="flex flex-col gap-2.5 border-t bg-muted/30 px-4.5 pt-3.5 pb-4.5">
				<p className="text-muted-foreground text-sm">{status}</p>
				{actions}
			</div>
		</section>
	)
}

/**
 * For a published listing with saved changes: they stay private until a
 * moderator approves them, so the panel offers only sending them.
 */
export function ChangesPanel({
	variant,
	message,
	actions,
}: {
	variant: PanelVariant
	message: string
	actions: ReactNode
}) {
	const headingId = useId()
	return (
		<section
			aria-labelledby={headingId}
			className={cn(
				'overflow-hidden rounded-lg border border-foreground/15 bg-card',
				variant === 'rail' && 'w-[300px]',
			)}
		>
			<div
				className={cn(
					'flex gap-3 p-4.5',
					variant === 'rail'
						? 'flex-col'
						: 'flex-col sm:flex-row sm:items-center sm:justify-between',
				)}
			>
				<div className="space-y-1">
					<h2 className="font-bold font-display" id={headingId}>
						Unsubmitted changes
					</h2>
					<p className="text-muted-foreground text-sm">{message}</p>
				</div>
				<div
					className={cn(
						'flex gap-2.5',
						variant === 'rail'
							? 'flex-col'
							: 'flex-wrap items-center',
					)}
				>
					{actions}
				</div>
			</div>
		</section>
	)
}
