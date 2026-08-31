import {
	ArrowLeft02Icon,
	Download01Icon,
	Package01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import {
	formatReleaseBytes,
	type PublicProjectRelease,
} from '@/components/projects/detail/project-releases'
import { ProjectVersionDownloadButton } from '@/components/projects/detail/project-version-download-button'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import {
	getProjectReleasePolicy,
	type ProjectType,
} from '@/lib/project-artifacts'

export function ProjectReleaseDetails({
	projectName,
	projectSlug,
	projectType,
	release,
}: {
	projectName: string
	projectSlug: string
	projectType: ProjectType
	release: PublicProjectRelease
}) {
	const releasePolicy = getProjectReleasePolicy(projectType)

	return (
		<article className="overflow-hidden rounded-lg border bg-card">
			<header className="space-y-4 border-b bg-muted/25 p-5 sm:p-6">
				<Link
					className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
					href={`/projects/${projectSlug}/releases`}
				>
					<HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
					All {projectName} releases
				</Link>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p className="text-muted-foreground text-sm">Release</p>
						<h2 className="font-semibold text-2xl tracking-tight">
							{release.version}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Published {formatDate(release.createdAt)}
						</p>
					</div>
					<ProjectVersionDownloadButton
						ariaLabel={`Download ${projectName} ${release.version}`}
						versionId={release._id}
					/>
				</div>
			</header>

			<div className="space-y-6 p-5 sm:p-6">
				{releasePolicy.requireGameVersions ? (
					<div className="flex flex-wrap gap-2">
						{release.gameVersions?.length ? (
							release.gameVersions.map((gameVersion) => (
								<Badge key={gameVersion} variant="secondary">
									Minecraft {gameVersion}
								</Badge>
							))
						) : (
							<Badge variant="outline">
								Compatibility not specified
							</Badge>
						)}
					</div>
				) : null}

				{releasePolicy.allowChangelog ? (
					<section className="space-y-3">
						<h3 className="font-semibold text-lg">Changelog</h3>
						{release.changelog ? (
							<RichTextViewer content={release.changelog} />
						) : (
							<p className="text-muted-foreground text-sm">
								No changelog was provided for this release.
							</p>
						)}
					</section>
				) : null}

				<section className="space-y-3 border-t pt-5">
					<h3 className="font-semibold text-sm">Release asset</h3>
					<div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<p className="flex items-center gap-2 truncate font-medium text-sm">
								<HugeiconsIcon
									className="size-4 shrink-0"
									icon={Package01Icon}
								/>
								{release.fileName}
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{formatReleaseBytes(release.fileSize)} -{' '}
								{release.downloads.toLocaleString()} downloads
							</p>
						</div>
						<Link
							className={buttonVariants({
								variant: 'outline',
								size: 'sm',
							})}
							href={`/api/projects/versions/${release._id}/download`}
						>
							<HugeiconsIcon
								className="size-4"
								icon={Download01Icon}
							/>
							Download
						</Link>
					</div>
				</section>
			</div>
		</article>
	)
}
