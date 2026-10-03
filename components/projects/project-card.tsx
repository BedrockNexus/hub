import {
	CubeIcon,
	Download01Icon,
	PaintBrush01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { RatingLabel, TagChip } from '@/components/servers/server-bits'
import { Skeleton } from '@/components/ui/skeleton'
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

const TYPE_ICON = {
	addon: CubeIcon,
	map: CubeIcon,
	resource_pack: PaintBrush01Icon,
} as const

export function ProjectCard({ content: item }: ProjectCardProps) {
	const categories = item.categories.flatMap((c) => (c ? [c.name] : []))
	const type = normalizeProjectType(item.type)
	const typeLabel = PROJECT_TYPE_LABELS[type]
	const downloads = item.totalDownloads ?? 0
	const reviewCount = item.reviewCount ?? 0

	return (
		<article className="relative flex h-full gap-4 rounded-md border bg-card p-4.5 transition-colors focus-within:border-ember hover:border-ember">
			<div className="tile-bevel relative grid size-18 shrink-0 place-items-center overflow-hidden rounded-sm bg-stone text-white">
				{item.iconUrl ? (
					<Image
						alt=""
						className="object-cover"
						fill
						sizes="72px"
						src={item.iconUrl}
					/>
				) : (
					<HugeiconsIcon
						aria-hidden
						className="size-8"
						icon={TYPE_ICON[type]}
					/>
				)}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<span className="eyebrow text-[11px]">{typeLabel}</span>
				<h3 className="truncate font-bold text-lg leading-tight">
					<Link
						className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
						href={`/projects/${item.slug}`}
					>
						{item.name}
					</Link>
				</h3>
				{item.summary ? (
					<p className="line-clamp-2 text-muted-foreground text-sm">
						{item.summary}
					</p>
				) : null}
				{categories.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{categories.slice(0, 3).map((tag) => (
							<TagChip key={tag}>{tag}</TagChip>
						))}
						{categories.length > 3 ? (
							<TagChip>+{categories.length - 3}</TagChip>
						) : null}
					</div>
				) : null}
				<div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[13px] text-muted-foreground">
					<span className="inline-flex items-center gap-1.5">
						<HugeiconsIcon
							aria-hidden
							className="size-3.5"
							icon={Download01Icon}
						/>
						<span className="font-mono text-foreground">
							{formatCount(downloads)}
						</span>
						<span className="sr-only">downloads</span>
					</span>
					<RatingLabel
						averageRating={item.averageRating}
						reviewCount={reviewCount}
					/>
					{item.latestVersionString ? (
						<span className="font-mono">
							v{item.latestVersionString}
						</span>
					) : null}
				</div>
			</div>
		</article>
	)
}

export function ProjectCardSkeleton() {
	return (
		<div className="flex gap-4 rounded-md border bg-card p-4.5">
			<Skeleton className="size-18 shrink-0" />
			<div className="flex flex-1 flex-col gap-2">
				<Skeleton className="h-3 w-16" />
				<Skeleton className="h-5 w-2/3" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-1/2" />
			</div>
		</div>
	)
}
