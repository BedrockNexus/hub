'use client'

import { Download01Icon, StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Doc } from '@/convex/_generated/dataModel'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
} from '@/lib/project-artifacts'

interface ProjectCardProps {
	content: Doc<'projects'> & {
		iconUrl?: string
		categories: (Doc<'projectCategories'> | null)[]
		averageRating?: number
		reviewCount?: number
		totalDownloads?: number
	}
}

function formatCompact(value: number): string {
	const withOneDecimal = (n: number) => {
		const output = n.toFixed(1)
		return output.endsWith('.0') ? output.slice(0, -2) : output
	}

	if (value >= 1_000_000) {
		return `${withOneDecimal(value / 1_000_000)}M`
	}

	if (value >= 1000) {
		return `${withOneDecimal(value / 1000)}K`
	}

	return value.toLocaleString()
}

function formatCount(n: number): string {
	return formatCompact(n)
}

export function ProjectCard({ content: item }: ProjectCardProps) {
	const categories = item.categories.filter(
		(category): category is Doc<'projectCategories'> => Boolean(category),
	)
	const allTags = categories.map((c) => c.name)
	const typeLabel = PROJECT_TYPE_LABELS[normalizeProjectType(item.type)]
	const downloads = item.totalDownloads ?? 0
	const rating = item.averageRating ?? 0
	const reviewCount = item.reviewCount ?? 0
	const visibleTags = allTags.slice(0, 3)
	const hiddenTagCount = Math.max(0, allTags.length - visibleTags.length)

	return (
		<Link
			className="block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			href={`/projects/${item.slug}`}
		>
			<Card className="group h-full cursor-pointer overflow-hidden transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md">
				<CardHeader className="relative">
					<div className="flex items-start gap-3">
						<div className="relative z-20 size-16 shrink-0 overflow-hidden rounded-lg bg-muted ring-2 ring-background">
							{item.iconUrl ? (
								<Image
									alt={item.name}
									className="object-cover"
									fill
									sizes="64px"
									src={item.iconUrl}
								/>
							) : (
								<div className="flex size-full items-center justify-center font-bold text-2xl text-muted-foreground">
									{item.name.charAt(0).toUpperCase()}
								</div>
							)}
						</div>

						<div className="min-w-0 flex-1 space-y-1">
							<h2 className="truncate font-semibold text-lg tracking-tight transition-colors group-hover:text-primary sm:text-xl">
								{item.name}
							</h2>

							{item.summary ? (
								<p className="line-clamp-2 text-muted-foreground text-sm leading-snug">
									{item.summary}
								</p>
							) : null}
						</div>
					</div>
				</CardHeader>

				<CardContent className="relative my-auto flex min-h-32 flex-col">
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant="outline">{typeLabel}</Badge>

						{visibleTags.length > 0 ? (
							<>
								{visibleTags.map((tag) => (
									<Badge key={tag} variant="secondary">
										{tag}
									</Badge>
								))}
								{hiddenTagCount > 0 && (
									<Badge variant="outline">
										+{hiddenTagCount}
									</Badge>
								)}
							</>
						) : null}
					</div>

					{visibleTags.length === 0 ? (
						<p className="mt-2 text-muted-foreground text-xs">
							No categories yet
						</p>
					) : null}

					<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
						<span className="inline-flex items-center gap-1">
							<HugeiconsIcon
								className="size-3.5 fill-primary text-primary"
								icon={StarIcon}
							/>
							{reviewCount > 0 ? (
								<>
									<span className="font-medium font-mono text-foreground">
										{rating.toFixed(1)}
									</span>
									<span>
										({formatCount(reviewCount)} reviews)
									</span>
								</>
							) : (
								<span>No reviews</span>
							)}
						</span>

						<span className="inline-flex items-center gap-1">
							<HugeiconsIcon
								className="size-3.5"
								icon={Download01Icon}
							/>
							<span className="font-medium font-mono text-foreground">
								{formatCount(downloads)}
							</span>
						</span>
					</div>

					{item.latestVersionString ? (
						<div className="mt-auto border-t pt-3 text-muted-foreground text-xs">
							Latest version:{' '}
							<span className="font-mono text-foreground">
								v{item.latestVersionString}
							</span>
						</div>
					) : null}
				</CardContent>
			</Card>
		</Link>
	)
}

export function ProjectCardSkeleton() {
	return (
		<Card className="overflow-hidden">
			<div className="relative px-4 pt-4 pb-4">
				<div className="mb-4 flex items-start gap-3">
					<div className="relative z-20 size-16 shrink-0 animate-pulse rounded-lg bg-muted ring-2 ring-background" />
					<div className="min-w-0 flex-1 space-y-2">
						<div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
						<div className="h-4 w-full animate-pulse rounded bg-muted" />
						<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
					</div>
				</div>
				<div className="flex gap-1.5">
					<div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
					<div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
					<div className="h-5 w-10 animate-pulse rounded-full bg-muted" />
				</div>
				<div className="mt-3 h-4 w-28 animate-pulse rounded bg-muted" />
			</div>
		</Card>
	)
}
