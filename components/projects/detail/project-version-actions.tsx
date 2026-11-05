import { VersionActions } from '@/components/detail/version-actions'
import { contentHref } from '@/lib/content-routes'
import type { ProjectType } from '@/lib/project-artifacts'

interface ProjectVersionActionsProps {
	projectType: ProjectType
	fileName: string
	projectSlug: string
	version: string
	downloadUrl: string
}

export function ProjectVersionActions({
	projectType,
	fileName,
	projectSlug,
	version,
	downloadUrl,
}: ProjectVersionActionsProps) {
	return (
		<VersionActions
			detailsHref={`${contentHref(projectType, projectSlug)}/releases/${encodeURIComponent(version)}`}
			downloadMode="json"
			downloadUrl={downloadUrl}
			fileName={fileName}
			version={version}
		/>
	)
}
