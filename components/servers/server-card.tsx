'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
	Status,
	StatusIndicator,
	StatusLabel,
} from '@/components/dice-ui/status'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Doc } from '@/convex/_generated/dataModel'

interface ServerCardProps {
	server: Doc<'servers'> & {
		logoUrl?: string
		bannerUrl?: string
		categories: (Doc<'serverCategories'> | null)[]
		online?: boolean
		playerCount?: number
	}
}

export function ServerCard({ server }: ServerCardProps) {
	const isOnline = server.online === true
	const playerCount = server.playerCount ?? 0
	let statusVariant: 'default' | 'error' | 'success' = 'default'
	let statusLabel = 'Unknown'

	if (server.online === false) {
		statusVariant = 'error'
		statusLabel = 'Offline'
	} else if (isOnline) {
		statusVariant = 'success'
		statusLabel = playerCount.toLocaleString()
	}

	const categories = server.categories.filter(
		(category): category is Doc<'serverCategories'> => Boolean(category),
	)
	const tags = server.tags ?? []
	const allTags = categories.length > 0 ? categories.map((c) => c.name) : tags

	return (
		<Link
			className="block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			href={`/servers/${server.slug}`}
		>
			<Card className="group h-full cursor-pointer overflow-hidden pt-0 transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md">
				<div className="relative">
					{/* Banner */}
					<div className="relative aspect-39/10 w-full overflow-hidden bg-muted">
						{server.bannerUrl ? (
							<Image
								alt={`${server.name} banner`}
								className="object-cover transition-transform duration-500 group-hover:scale-105"
								fill
								sizes="(max-width: 768px) 100vw, 50vw"
								src={server.bannerUrl}
							/>
						) : (
							<div className="absolute inset-0 bg-linear-to-br from-muted to-muted/50" />
						)}
					</div>
					{/* Logo overlapping banner */}
					<div className="absolute -bottom-6 left-4 size-12 overflow-hidden rounded-lg bg-muted ring-2 ring-background">
						{server.logoUrl ? (
							<Image
								alt={server.name}
								className="object-cover"
								fill
								sizes="48px"
								src={server.logoUrl}
							/>
						) : (
							<div className="flex size-full items-center justify-center font-bold text-lg text-muted-foreground">
								{server.name.charAt(0).toUpperCase()}
							</div>
						)}
					</div>
				</div>

				<CardHeader className="relative min-h-20 pt-6">
					{/* Name + online status */}
					<div className="flex min-w-0 items-center justify-between gap-2">
						<h2 className="min-w-0 truncate font-semibold text-lg tracking-tight transition-colors group-hover:text-primary sm:text-xl">
							{server.name}
						</h2>
						<span className="flex shrink-0 items-center text-muted-foreground text-xs">
							<Status variant={statusVariant}>
								<StatusIndicator />
								<StatusLabel className="font-mono text-[11px]">
									{statusLabel}
								</StatusLabel>
							</Status>
						</span>
					</div>
				</CardHeader>

				<CardContent className="relative my-auto flex min-h-24 flex-col">
					{/* Description */}
					{server.smallDescription && (
						<p className="mb-3 line-clamp-2 text-muted-foreground text-sm leading-snug">
							{server.smallDescription}
						</p>
					)}

					{/* Tags */}
					{allTags.length > 0 && (
						<div className="mt-auto flex flex-wrap items-center gap-1.5">
							{allTags.slice(0, 3).map((tag) => (
								<Badge key={tag} variant="secondary">
									{tag}
								</Badge>
							))}
							{allTags.length > 3 && (
								<Badge variant="outline">
									+{allTags.length - 3}
								</Badge>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</Link>
	)
}

// Skeleton for loading state
export function ServerCardSkeleton() {
	return (
		<Card className="overflow-hidden pt-0">
			<div className="aspect-39/10 w-full animate-pulse bg-muted" />
			<div className="relative px-4 pt-8 pb-4">
				<div className="absolute -top-6 left-4 size-12 animate-pulse rounded-lg bg-muted ring-2 ring-background" />
				<div className="mb-2 flex items-center justify-between">
					<div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
					<div className="h-4 w-16 animate-pulse rounded bg-muted" />
				</div>
				<div className="mb-3 space-y-1.5">
					<div className="h-4 w-full animate-pulse rounded bg-muted" />
					<div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
				</div>
				<div className="flex gap-1.5">
					<div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
					<div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
				</div>
			</div>
			<div className="flex justify-center border-t px-4 py-3">
				<div className="h-4 w-40 animate-pulse rounded bg-muted" />
			</div>
		</Card>
	)
}
