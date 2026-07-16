export type R2ImageResourceType = 'projects' | 'servers'
export type R2ImageKind = 'icon' | 'logo' | 'banner' | 'gallery'

interface UploadFileToPresignedUrlArgs {
	file: File
	url: string
	onProgress?: (progress: number) => void
}

export function uploadFileToPresignedUrl({
	file,
	url,
	onProgress,
}: UploadFileToPresignedUrlArgs): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest()

		request.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				onProgress?.(Math.round((event.loaded / event.total) * 100))
			}
		}

		request.onload = () => {
			if (request.status >= 200 && request.status < 300) {
				resolve()
				return
			}

			reject(new Error(`Upload failed with status ${request.status}`))
		}

		request.onerror = () => reject(new Error('Network error during upload'))
		request.open('PUT', url)
		request.setRequestHeader(
			'Content-Type',
			file.type || 'application/octet-stream',
		)
		request.send(file)
	})
}
