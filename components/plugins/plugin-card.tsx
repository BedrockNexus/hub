import {
	CheckmarkBadge01Icon,
	Download01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
	formatCompactNumber,
	formatRegistryDate,
} from '@/lib/plugins/format-registry'
import { cn } from '@/lib/utils'

export interface PublicProjectCard {
	slug: string
	name: string
	summary: string
	license?: string
	downloadCount: number
	updatedAt?: number
	software: { slug: string; name: string }
	latestVersion: {
		version: string
		verifiedBuild: boolean
		publishedAt?: number
	} | null
	creator: {
		username: string
		displayName: string
		avatarUrl?: string
	} | null
	organization: { slug: string; name: string; avatarUrl?: string } | null
}

export function projectOwner(
	project: Pick<PublicProjectCard, 'creator' | 'organization'>,
) {
	if (project.organization) {
		return {
			label: project.organization.name,
			avatarUrl: project.organization.avatarUrl,
		}
	}
	if (project.creator) {
		return {
			label: `@${project.creator.username}`,
			avatarUrl: project.creator.avatarUrl,
		}
	}
	return { label: 'Independent creator', avatarUrl: undefined }
}

export function ProjectAvatar({
	name,
	avatarUrl,
	className,
}: {
	name: string
	avatarUrl?: string
	className?: string
}) {
	return (
		<Avatar
			className={cn(
				'tile-bevel size-12 rounded-sm bg-stone after:rounded-sm',
				className,
			)}
		>
			{avatarUrl ? (
				<AvatarImage alt="" className="rounded-none" src={avatarUrl} />
			) : null}
			<AvatarFallback className="rounded-none bg-stone font-bold font-display text-lg text-white">
				{name.slice(0, 1).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	)
}

export function ProjectListItem({ project }: { project: PublicProjectCard }) {
	const owner = projectOwner(project)
	const updated = project.latestVersion?.publishedAt ?? project.updatedAt

	return (
		<article className="group relative flex gap-4 p-4 transition-colors hover:bg-muted sm:p-5">
			<ProjectAvatar avatarUrl={owner.avatarUrl} name={project.name} />

			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<h3 className="font-bold text-lg leading-6">
						<Link
							className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline group-hover:underline"
							href={`/plugins/${project.slug}` as Route}
						>
							{project.name}
						</Link>
					</h3>
					<span className="truncate text-muted-foreground text-sm">
						by {owner.label}
					</span>
				</div>
				<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-6">
					{project.summary}
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
					<Badge variant="outline">{project.software.name}</Badge>
					{project.latestVersion?.verifiedBuild ? (
						<Badge variant="default">
							<HugeiconsIcon
								className="size-3.5"
								icon={CheckmarkBadge01Icon}
							/>
							Traceable build
						</Badge>
					) : null}
					{project.license ? <span>{project.license}</span> : null}
					<span className="flex items-center gap-1 sm:hidden">
						<HugeiconsIcon
							className="size-3.5"
							icon={Download01Icon}
						/>
						{formatCompactNumber(project.downloadCount)}
					</span>
				</div>
			</div>

			<dl className="hidden w-32 shrink-0 flex-col items-end gap-1 text-right text-muted-foreground text-xs sm:flex">
				<div className="flex items-center gap-1.5">
					<dt className="sr-only">Downloads</dt>
					<HugeiconsIcon
						aria-hidden="true"
						className="size-3.5"
						icon={Download01Icon}
					/>
					<dd className="font-semibold text-foreground text-sm">
						{formatCompactNumber(project.downloadCount)}
					</dd>
				</div>
				{project.latestVersion ? (
					<div>
						<dt className="sr-only">Latest version</dt>
						<dd className="font-mono">
							v{project.latestVersion.version}
						</dd>
					</div>
				) : null}
				{updated ? (
					<div>
						<dt className="sr-only">Updated</dt>
						<dd>{formatRegistryDate(updated)}</dd>
					</div>
				) : null}
			</dl>
		</article>
	)
}

export function ProjectList({
	projects,
}: {
	projects: readonly PublicProjectCard[]
}) {
	return (
		<div className="divide-y overflow-hidden rounded-md border bg-card">
			{projects.map((project) => (
				<ProjectListItem key={project.slug} project={project} />
			))}
		</div>
	)
}
