import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type CreateListingKind = 'addon' | 'resource_pack' | 'server' | 'plugin'

const KINDS: {
	kind: CreateListingKind
	label: string
	hint: string
	href: Route
}[] = [
	{
		kind: 'addon',
		label: 'Addon',
		hint: 'Behavior or resource packs that add to the game',
		href: '/dashboard/addons/add',
	},
	{
		kind: 'resource_pack',
		label: 'Resource pack',
		hint: 'Textures, sounds and models',
		href: '/dashboard/resource-packs/add',
	},
	{
		kind: 'server',
		label: 'Server',
		hint: 'A Bedrock server people can join',
		href: '/dashboard/servers/add',
	},
	{
		kind: 'plugin',
		label: 'Plugin',
		hint: 'A server plugin, built from GitHub',
		href: '/dashboard/plugins/new',
	},
]

interface CreateListingShellProps {
	/** The kind being created; highlighted in the type picker. */
	kind: CreateListingKind
	/** Plugins are listed only while the Plugins feature is on. */
	showPlugins: boolean
	/** Small line above the title. */
	eyebrow?: string
	title?: string
	intro?: string
	/** Hide the type picker, e.g. on a later step. */
	hideKinds?: boolean
	children: ReactNode
}

/**
 * The narrow, sidebar-free frame of every create screen: what you are making,
 * a picker to switch kind, then only the fields needed to start a draft.
 * Everything else is added from the listing's dashboard afterwards.
 */
export function CreateListingShell({
	kind,
	showPlugins,
	eyebrow = 'New listing',
	title = 'What are you sharing?',
	intro = 'Start with the basics. You add the description, categories, images and files on the next screen.',
	hideKinds = false,
	children,
}: CreateListingShellProps) {
	const kinds = KINDS.filter((item) => showPlugins || item.kind !== 'plugin')

	return (
		<div className="mx-auto flex w-full max-w-[600px] flex-col gap-9 py-6 sm:py-10">
			<div className="flex flex-col gap-2">
				<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
					{eyebrow}
				</p>
				<h1 className="font-bold font-display text-3xl leading-tight sm:text-[2.1rem]">
					{title}
				</h1>
				<p className="text-[0.95rem] text-muted-foreground leading-relaxed">
					{intro}
				</p>
			</div>

			{hideKinds ? null : (
				<nav aria-label="What you are creating">
					<ul
						className={cn(
							'grid gap-3',
							kinds.length === 4
								? 'grid-cols-1 sm:grid-cols-2'
								: 'grid-cols-1 sm:grid-cols-3',
						)}
					>
						{kinds.map((item) => {
							const active = item.kind === kind
							return (
								<li key={item.kind}>
									<Link
										aria-current={
											active ? 'page' : undefined
										}
										className={cn(
											'flex h-full flex-col gap-1.5 rounded-lg border p-4 transition-colors',
											'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
											active
												? 'border-primary bg-card ring-1 ring-primary ring-inset'
												: 'bg-card/60 hover:border-foreground/25 hover:bg-card',
										)}
										href={item.href}
										replace
									>
										<span className="flex items-center justify-between gap-2">
											<span className="font-bold font-display text-[1.05rem]">
												{item.label}
											</span>
											<span
												aria-hidden
												className={cn(
													'size-3.5 shrink-0 rounded-full',
													active
														? 'bg-primary ring-3 ring-primary/25'
														: 'border-[1.5px] border-muted-foreground/60',
												)}
											/>
										</span>
										<span className="text-muted-foreground text-sm leading-snug">
											{item.hint}
										</span>
									</Link>
								</li>
							)
						})}
					</ul>
				</nav>
			)}

			{children}
		</div>
	)
}

/** The bottom row of a create screen: what happens next, and the action. */
export function CreateListingFooter({
	note,
	children,
}: {
	note: string
	children: ReactNode
}) {
	return (
		<div className="flex flex-col-reverse gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-muted-foreground text-sm">{note}</p>
			<div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
				{children}
			</div>
		</div>
	)
}
