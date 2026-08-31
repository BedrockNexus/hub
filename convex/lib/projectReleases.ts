import { isCdnR2Key } from './r2Keys'

export function isValidatedRelease(release: {
	validationStatus?: string
}): boolean {
	return (
		release.validationStatus === undefined ||
		release.validationStatus === 'valid'
	)
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
