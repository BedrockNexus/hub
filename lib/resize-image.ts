const FILE_EXTENSION = /\.[^.]+$/

/**
 * Crops an image to a centered square and scales it to `size` pixels, as
 * WebP. GIFs are returned unchanged so animation survives. Runs in the browser.
 */
export async function resizeSquareImage(file: File, size = 256) {
	if (file.type === 'image/gif') {
		return file
	}
	const bitmap = await createImageBitmap(file)
	const side = Math.min(bitmap.width, bitmap.height)
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')
	if (!context) {
		bitmap.close()
		return file
	}
	context.imageSmoothingQuality = 'high'
	context.drawImage(
		bitmap,
		(bitmap.width - side) / 2,
		(bitmap.height - side) / 2,
		side,
		side,
		0,
		0,
		size,
		size,
	)
	bitmap.close()
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/webp', 0.9),
	)
	if (!blob) {
		return file
	}
	return new File([blob], `${file.name.replace(FILE_EXTENSION, '')}.webp`, {
		type: 'image/webp',
	})
}
