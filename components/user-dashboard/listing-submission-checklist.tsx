'use client'

import { Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'
import { type ReactNode, useId, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ListingCheck {
	label: string
	/** Where it is done: a sub-path of the listing ('' is General), or `#id` on General. */
	section: string
	required: boolean
	complete: boolean
}

/**
 * What a listing still needs before it can be submitted, with a link to
 * where each step is done. Shown on the General page of a draft and on the
 * Preview & submission page; `children` is the submit area.
 */
export function ListingSubmissionChecklist({
	checks,
	basePath,
	title = 'Finish your listing',
	collapsible = false,
	children,
}: {
	checks: ListingCheck[]
	basePath: string
	title?: string
	/** Let the creator fold the steps away (on General). */
	collapsible?: boolean
	children?: ReactNode
}) {
	const headingId = useId()
	const listId = useId()
	const [open, setOpen] = useState(true)
	const done = checks.filter((check) => check.complete).length
	const requiredLeft = checks.filter(
		(check) => check.required && !check.complete,
	).length
	const percent = checks.length
		? Math.round((done / checks.length) * 100)
		: 100

	return (
		<section
			aria-labelledby={headingId}
			className="overflow-hidden rounded-lg border border-foreground/15 bg-card"
		>
			<div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
				<div className="space-y-1">
					<h2
						className="font-bold font-display text-lg"
						id={headingId}
					>
						{title}
					</h2>
					<p className="text-muted-foreground text-sm">
						{done} of {checks.length} done
					</p>
				</div>
				{collapsible ? (
					<button
						aria-controls={listId}
						aria-expanded={open}
						className="min-h-10 rounded-sm px-1 font-medium text-primary text-sm hover:underline focus-visible:outline-2 focus-visible:outline-primary"
						onClick={() => setOpen((value) => !value)}
						type="button"
					>
						{open ? 'Hide steps' : 'Show steps'}
					</button>
				) : null}
			</div>
			<div
				aria-hidden
				className="mx-5 h-1 overflow-hidden rounded-full bg-muted"
			>
				<div
					className="h-full rounded-full bg-primary transition-[width]"
					style={{ width: `${percent}%` }}
				/>
			</div>

			{open ? (
				<ul className="mt-3" id={listId}>
					{checks.map((check) => (
						<li
							className="flex min-h-13 items-center gap-3.5 border-t px-5 py-1.5"
							key={check.label}
						>
							<span
								aria-hidden
								className={cn(
									'flex size-5.5 shrink-0 items-center justify-center rounded-full',
									check.complete
										? 'bg-primary text-primary-foreground'
										: 'border-[1.5px] border-muted-foreground/50',
								)}
							>
								{check.complete ? (
									<HugeiconsIcon
										icon={Tick02Icon}
										size={14}
										strokeWidth={2.5}
									/>
								) : null}
							</span>
							<span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
								<span className="sr-only">
									{check.complete ? 'Done: ' : 'To do: '}
								</span>
								<span
									className={cn(
										'text-sm',
										check.complete
											? 'text-muted-foreground line-through decoration-muted-foreground/50'
											: 'font-medium',
									)}
								>
									{check.label}
								</span>
								<span className="text-muted-foreground text-xs">
									{check.required
										? 'Required'
										: 'Recommended'}
								</span>
							</span>
							{check.complete ? null : (
								<Link
									className="inline-flex min-h-10 items-center font-medium text-primary text-sm hover:underline"
									href={
										`${basePath}${check.section}` as Route
									}
								>
									Open
									<span className="sr-only">
										: {check.label}
									</span>
								</Link>
							)}
						</li>
					))}
				</ul>
			) : null}

			{children ? (
				<div className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-muted-foreground text-sm">
						{requiredLeft > 0
							? `${requiredLeft} required ${requiredLeft === 1 ? 'step' : 'steps'} left before you can submit`
							: 'Everything required is done'}
					</p>
					<div className="flex flex-wrap items-center gap-3">
						{children}
					</div>
				</div>
			) : null}
		</section>
	)
}
