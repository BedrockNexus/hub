function isDirectMediaUrl(value: string | null | undefined): value is string {
	return (
		!!value &&
		(value.startsWith('http://') ||
			value.startsWith('https://') ||
			value.startsWith('data:') ||
			value.startsWith('blob:') ||
			value.startsWith('/'))
	)
}

/**
 * The picture someone uploaded, or nothing. Without one the avatar shows the
 * first letter of the name (see components/auth/user-avatar-image.tsx).
 */
export function getAvatarUrl(
	image: string | null | undefined,
): string | undefined {
	return isDirectMediaUrl(image) ? image : undefined
}
