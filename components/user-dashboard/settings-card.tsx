import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The title of a listing settings page. */
export function SettingsPageHeader({
	title,
	description,
}: {
	title: string
	description: string
}) {
	return (
		<div className="space-y-1">
			<h1 className="font-bold font-display text-2xl">{title}</h1>
			<p className="text-muted-foreground text-sm">{description}</p>
		</div>
	)
}

/**
 * A group of related settings on a listing settings page. `flush` lets rows
 * reach the edges, for lists of switches separated by dividers.
 */
export function SettingsCard({
	id,
	title,
	description,
	flush = false,
	children,
}: {
	/** Anchor the checklist links to. */
	id?: string
	title: string
	description?: string
	flush?: boolean
	children: ReactNode
}) {
	const headingId = id ? `${id}-title` : undefined
	return (
		<section
			aria-labelledby={headingId}
			className="scroll-mt-24 rounded-lg border bg-card"
			id={id}
		>
			<div className={cn('px-5 pt-5 sm:px-6', flush ? 'pb-1' : 'pb-0')}>
				<h2
					className="font-semibold text-muted-foreground text-sm"
					id={headingId}
				>
					{title}
				</h2>
				{description ? (
					<p className="mt-1 text-muted-foreground text-sm">
						{description}
					</p>
				) : null}
			</div>
			<div
				className={cn(
					flush
						? 'divide-y'
						: 'flex flex-col gap-5 px-5 pt-4 pb-5 sm:px-6 sm:pb-6',
				)}
			>
				{children}
			</div>
		</section>
	)
}

/** One line of a flush SettingsCard: a label on the left, a control on the right. */
export function SettingsRow({
	label,
	description,
	htmlFor,
	children,
}: {
	label: string
	description?: string
	htmlFor?: string
	children: ReactNode
}) {
	return (
		<div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 sm:px-6">
			<div className="min-w-0 space-y-0.5">
				{htmlFor ? (
					<label className="font-medium text-sm" htmlFor={htmlFor}>
						{label}
					</label>
				) : (
					<p className="font-medium text-sm">{label}</p>
				)}
				{description ? (
					<p className="text-muted-foreground text-sm">
						{description}
					</p>
				) : null}
			</div>
			{children}
		</div>
	)
}
