import { Download01Icon, Package01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { ProjectVersionActions } from '@/components/projects/detail/project-version-actions'
import { Badge } from '@/components/ui/badge'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'

export interface PublicProjectRelease {
	_id: string
	version: string
	downloadUrl: string
	downloads: number
	fileName: string
	fileSize: number
	gameVersions?: string[]
	changelog?: string
	createdAt: number
}

export function formatReleaseBytes(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectReleases({
	projectSlug,
	releases,
}: {
	projectSlug: string
	releases: PublicProjectRelease[] | undefined
}) {
	if (releases === undefined) {
		return (
			<div className="space-y-4">
				{['one', 'two', 'three'].map((key) => (
					<div className="space-y-4 rounded-lg border p-5" key={key}>
						<Skeleton className="h-6 w-40" />
						<Skeleton className="h-4 w-64" />
						<Skeleton className="h-20 w-full" />
					</div>
				))}
			</div>
		)
	}

	if (releases.length === 0) {
		return (
			<Empty className="border border-border/70 border-dashed py-14">
				<EmptyHeader>
					<EmptyTitle>No Releases Yet</EmptyTitle>
					<EmptyDescription>
						The creator has not published a downloadable release
						yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<div className="space-y-4">
			{releases.map((release, index) => (
				<article
					className="overflow-hidden rounded-lg border bg-card"
					key={release._id}
				>
					<header className="flex flex-col gap-4 border-b bg-muted/25 p-5 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0 space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<Link
									className="font-semibold text-lg hover:text-primary hover:underline"
									href={`/projects/${projectSlug}/releases/${encodeURIComponent(release.version)}`}
								>
									{release.version}
								</Link>
								{index === 0 ? <Badge>Latest</Badge> : null}
							</div>
							<p className="text-muted-foreground text-sm">
								Published {formatDate(release.createdAt)}
							</p>
						</div>
						<ProjectVersionActions
							fileName={release.fileName}
							projectSlug={projectSlug}
							version={release.version}
							versionId={release._id}
						/>
					</header>

					<div className="space-y-5 p-5">
						{release.gameVersions?.length ? (
							<div className="flex flex-wrap gap-1.5">
								{release.gameVersions.map((gameVersion) => (
									<Badge
										key={gameVersion}
										variant="secondary"
									>
										Minecraft {gameVersion}
									</Badge>
								))}
							</div>
						) : null}

						{release.changelog ? (
							<RichTextViewer content={release.changelog} />
						) : (
							<p className="text-muted-foreground text-sm">
								No changelog was provided for this release.
							</p>
						)}

						<div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-muted-foreground text-sm">
							<span className="inline-flex items-center gap-2">
								<HugeiconsIcon
									className="size-4"
									icon={Package01Icon}
								/>
								{release.fileName} (
								{formatReleaseBytes(release.fileSize)})
							</span>
							<span className="inline-flex items-center gap-2">
								<HugeiconsIcon
									className="size-4"
									icon={Download01Icon}
								/>
								{release.downloads.toLocaleString()} downloads
							</span>
						</div>
					</div>
				</article>
			))}
		</div>
	)
}
