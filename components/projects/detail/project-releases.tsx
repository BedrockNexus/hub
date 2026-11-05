import { ReleaseHistory } from '@/components/detail/release-history'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { ProjectVersionActions } from '@/components/projects/detail/project-version-actions'
import { contentHref } from '@/lib/content-routes'
import type { ProjectType } from '@/lib/project-artifacts'

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
	projectType,
	projectSlug,
	releases,
}: {
	projectType: ProjectType
	projectSlug: string
	releases: PublicProjectRelease[] | undefined
}) {
	return (
		<ReleaseHistory
			entries={releases?.map((release) => ({
				id: release._id,
				version: release.version,
				href: `${contentHref(projectType, projectSlug)}/releases/${encodeURIComponent(release.version)}`,
				gameVersions: release.gameVersions ?? [],
				platform: 'Bedrock',
				publishedAt: release.createdAt,
				downloads: release.downloads,
				size: formatReleaseBytes(release.fileSize),
				notes: release.changelog?.trim() ? (
					<RichTextViewer content={release.changelog} />
				) : (
					<p className="text-muted-foreground text-sm">
						No changelog was provided for this release.
					</p>
				),
				actions: (
					<ProjectVersionActions
						downloadUrl={release.downloadUrl}
						fileName={release.fileName}
						projectSlug={projectSlug}
						projectType={projectType}
						version={release.version}
					/>
				),
			}))}
			showPlatformFilter={false}
		/>
	)
}
