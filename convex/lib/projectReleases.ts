import { isCdnR2Key } from './r2Keys'

export function isValidatedRelease(release: {
	validationStatus?: string
}): boolean {
	return (
		release.validationStatus === undefined ||
		release.validationStatus === 'valid'
	)
}

/**
 * Every release of a public project needs moderator approval before it can be
 * downloaded. Releases created before release review existed have no
 * `reviewStatus` and were approved with their project.
 */
export function isApprovedRelease(release: { reviewStatus?: string }): boolean {
	return release.reviewStatus === undefined || release.reviewStatus === 'approved'
}

/** Validated by the artifact validator and approved by a moderator. */
export function isPublicRelease(release: {
	validationStatus?: string
	reviewStatus?: string
}): boolean {
	return isValidatedRelease(release) && isApprovedRelease(release)
}

export function getPublishedReleaseKey(release: {
	r2Key: string
	uploadR2Key?: string
	cdnR2Key?: string
}): string | undefined {
	if (release.cdnR2Key) return release.cdnR2Key
	if (!release.uploadR2Key && isCdnR2Key(release.r2Key)) {
		return release.r2Key
	}
	return undefined
}
