import {
	mapReleaseMetadataSchema,
	mapReleaseObservationIssues,
} from '../../lib/map-release-metadata'
import { mapValidationReportSchema } from '../../lib/map-validation-report'

export interface MapReleaseCandidate {
	artifactType?: string
	fileName?: string
	fileSize?: number
	validationStatus?: string
	reviewStatus?: string
	releaseMetadata?: unknown
	mapValidationReport?: unknown
	sealedR2Key?: string
	sealedEtag?: string
	gameVersions?: string[]
	deletionRequestedAt?: number
}
export function isMapRelease(
	release: MapReleaseCandidate,
	projectType?: string,
) {
	return (
		projectType === 'map' ||
		release.artifactType === 'map' ||
		release.fileName?.toLowerCase().endsWith('.mcworld') === true ||
		(release.releaseMetadata as { type?: unknown } | undefined)?.type ===
			'map'
	)
}
export function isValidatedMapRelease(release: MapReleaseCandidate): boolean {
	if (
		release.validationStatus !== 'valid' ||
		release.artifactType !== 'map' ||
		release.deletionRequestedAt ||
		!release.sealedR2Key ||
		!release.sealedEtag ||
		!release.gameVersions?.length
	)
		return false
	const metadata = mapReleaseMetadataSchema.safeParse(release.releaseMetadata)
	const report = mapValidationReportSchema.safeParse(
		release.mapValidationReport,
	)
	return (
		metadata.success &&
		report.success &&
		report.data.sourceEtag === release.sealedEtag &&
		report.data.fileSize === release.fileSize &&
		mapReleaseObservationIssues(metadata.data, report.data).length === 0
	)
}
