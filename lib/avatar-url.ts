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

export function getAvatarUrl(
	image: string | null | undefined,
	name: string,
	size = 60,
): string {
	if (isDirectMediaUrl(image)) {
		return image
	}

	return `https://avatar.vercel.sh/${encodeURIComponent(name)}?size=${size}`
}
