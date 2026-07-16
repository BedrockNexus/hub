/**
 * Upload a file using files-control's presigned URL flow and return the storageId.
 *
 * Steps:
 *  1. Call `generateUploadUrl()` → `{ uploadUrl, uploadToken }`
 *  2. PUT/POST the file to `uploadUrl` → `{ storageId }`
 *  3. Call `finalizeUpload({ uploadToken, storageId, fileName })` to register access keys
 */
export async function uploadFileToConvex(
	generateUploadUrl: () => Promise<{
		uploadUrl: string
		uploadToken: string
	}>,
	finalizeUpload: (args: {
		uploadToken: string
		storageId: string
		fileName: string
	}) => Promise<unknown>,
	file: File,
): Promise<string> {
	const { uploadUrl, uploadToken } = await generateUploadUrl()

	const response = await fetch(uploadUrl, {
		method: 'POST',
		headers: { 'Content-Type': file.type || 'application/octet-stream' },
		body: file,
	})
	if (!response.ok) {
		throw new Error('Failed to upload file')
	}

	const json: unknown = await response.json()
	if (
		typeof json !== 'object' ||
		json === null ||
		!('storageId' in json) ||
		typeof (json as { storageId?: unknown }).storageId !== 'string'
	) {
		throw new Error('Failed to get storage ID from upload response')
	}

	const storageId = (json as { storageId: string }).storageId

	await finalizeUpload({ uploadToken, storageId, fileName: file.name })

	return storageId
}

/**
 * Resolve the final storage ID for a file upload field.
 *
 * Returns:
 * - `null` if the user chose to remove the image
 * - `string` (storageId) if a new file was uploaded
 * - `undefined` if nothing changed (no file selected, no removal)
 */
export function resolveFileUpload(
	generateUploadUrl: () => Promise<{
		uploadUrl: string
		uploadToken: string
	}>,
	finalizeUpload: (args: {
		uploadToken: string
		storageId: string
		fileName: string
	}) => Promise<unknown>,
	files: File[],
	remove: boolean,
): Promise<string | null | undefined> {
	if (remove) {
		return Promise.resolve(null)
	}
	const file = files[0]
	if (!file) {
		return Promise.resolve(undefined)
	}
	return uploadFileToConvex(generateUploadUrl, finalizeUpload, file)
}
