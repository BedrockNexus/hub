'use client'

import {
	CheckmarkCircle02Icon,
	Copy01Icon,
	Link01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type Dependency = NonNullable<
	FunctionReturnType<
		typeof api.functions.projects.versions.listPublicDependencies
	>
>[number]

function DependencyName({ item }: { item: Dependency }) {
	if (item.listing) {
		return (
			<Link
				className="font-medium text-ember-text hover:text-foreground"
				href={item.listing.href as Route}
			>
				{item.listing.name}
			</Link>
		)
	}
	if (!item.externalName) {
		return (
			<span className="text-muted-foreground">
				A pack that is not on BedrockNexus
			</span>
		)
	}
	if (!item.externalUrl) {
		return <span className="font-medium">{item.externalName}</span>
	}
	return (
		<a
			className="inline-flex items-center gap-1 font-medium text-ember-text hover:text-foreground"
			href={item.externalUrl}
			rel="noopener noreferrer nofollow"
			target="_blank"
		>
			<HugeiconsIcon aria-hidden className="size-3.5" icon={Link01Icon} />
			{item.externalName}
		</a>
	)
}

const KIND_HEADINGS = {
	required: 'Requires',
	optional: 'Works with',
	incompatible: 'Incompatible with',
} as const

/**
 * What a release needs or conflicts with. Dependencies read from the pack
 * manifest are labelled separately from what the creator declared.
 */
export function ReleaseDependencies({
	versionId,
}: {
	versionId: Id<'projectVersions'>
}) {
	const dependencies = useQuery(
		api.functions.projects.versions.listPublicDependencies,
		{ versionId },
	)
	if (!dependencies?.length) {
		return null
	}
	return (
		<section className="space-y-3">
			<h3 className="font-semibold text-lg">Dependencies</h3>
			{(['required', 'optional', 'incompatible'] as const).map((kind) => {
				const items = dependencies.filter((item) => item.kind === kind)
				if (items.length === 0) {
					return null
				}
				return (
					<div className="space-y-1.5" key={kind}>
						<p className="font-medium text-muted-foreground text-sm">
							{KIND_HEADINGS[kind]}
						</p>
						<ul className="space-y-1.5">
							{items.map((item) => (
								<li
									className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-sm"
									key={
										item.listing?.targetId ??
										item.packUuid ??
										item.externalName
									}
								>
									<DependencyName item={item} />
									{item.packVersion ? (
										<span className="font-mono text-muted-foreground text-xs">
											{item.packVersion}
										</span>
									) : null}
									<span className="ml-auto text-muted-foreground text-xs">
										{item.source === 'manifest'
											? 'From the pack manifest'
											: 'Listed by the creator'}
									</span>
								</li>
							))}
						</ul>
					</div>
				)
			})}
		</section>
	)
}

/** The checks every public release passed, and its checksum. */
export function ReleaseChecks({
	validated,
	reviewed,
	sha256,
}: {
	validated: boolean
	reviewed: boolean
	sha256?: string
}) {
	return (
		<section className="space-y-3 border-t pt-5">
			<h3 className="font-semibold text-sm">Checks</h3>
			<ul className="space-y-1.5 text-sm">
				{validated ? (
					<li className="flex items-center gap-2">
						<HugeiconsIcon
							aria-hidden
							className="size-4 text-online"
							icon={CheckmarkCircle02Icon}
						/>
						Passed automatic file checks (format, no programs or
						system scripts)
					</li>
				) : null}
				{reviewed ? (
					<li className="flex items-center gap-2">
						<HugeiconsIcon
							aria-hidden
							className="size-4 text-online"
							icon={CheckmarkCircle02Icon}
						/>
						Reviewed by a BedrockNexus moderator
					</li>
				) : null}
			</ul>
			<p className="text-muted-foreground text-xs">
				Checks confirm the file is a well-formed pack. They do not test
				how it plays in Minecraft.
			</p>
			{sha256 ? (
				<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
					<span className="shrink-0 font-medium text-xs">
						SHA-256
					</span>
					<code className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
						{sha256}
					</code>
					<Button
						aria-label="Copy SHA-256 checksum"
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(sha256)
								toast.success('Checksum copied')
							} catch {
								toast.error('Could not copy the checksum')
							}
						}}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<HugeiconsIcon icon={Copy01Icon} />
					</Button>
				</div>
			) : null}
		</section>
	)
}
