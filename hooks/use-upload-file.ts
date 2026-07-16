import { useMutation } from 'convex/react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/convex/_generated/api'
import { uploadFileToPresignedUrl } from '@/lib/r2-upload'

type EditorMediaKind = 'audio' | 'file' | 'image' | 'video'

export interface UploadedFile {
	appUrl: string
	key: string
	name: string
	r2Key: string
	size: number
	type: string
	url: string
}

interface UseUploadFileProps {
	onUploadBegin?: (fileName: string) => void
	onUploadComplete?: (file: UploadedFile) => void
	onUploadError?: (error: unknown) => void
	onUploadProgress?: (options: { file: File; progress: number }) => void
}

function getEditorMediaKind(file: File): EditorMediaKind {
	if (file.type.startsWith('image/')) {
		return 'image'
	}
	if (file.type.startsWith('audio/')) {
		return 'audio'
	}
	if (file.type.startsWith('video/')) {
		return 'video'
	}

	return 'file'
}

function getEditorMediaUrl(key: string): string {
	return `/api/r2/editor-media/${key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')}`
}

export function useUploadFile({
	onUploadBegin,
	onUploadComplete,
	onUploadError,
	onUploadProgress,
}: UseUploadFileProps = {}) {
	const [uploadedFile, setUploadedFile] = useState<UploadedFile>()
	const [uploadingFile, setUploadingFile] = useState<File>()
	const [progress, setProgress] = useState<number>(0)
	const [isUploading, setIsUploading] = useState(false)
	const generateUploadUrl = useMutation(
		api.functions.storage.generateEditorMediaUploadUrl,
	)
	const syncMetadata = useMutation(api.lib.r2.syncMetadata)

	const uploadFile = useCallback(
		async (file: File) => {
			setIsUploading(true)
			setUploadingFile(file)
			onUploadBegin?.(file.name)

			try {
				const { key, url } = await generateUploadUrl({
					mediaKind: getEditorMediaKind(file),
					fileName: file.name,
				})

				await uploadFileToPresignedUrl({
					file,
					url,
					onProgress: (nextProgress) => {
						const boundedProgress = Math.min(nextProgress, 100)
						setProgress(boundedProgress)
						onUploadProgress?.({ file, progress: boundedProgress })
					},
				})

				await syncMetadata({ key })

				const stableUrl = getEditorMediaUrl(key)
				const nextUploadedFile: UploadedFile = {
					appUrl: stableUrl,
					key,
					name: file.name,
					r2Key: key,
					size: file.size,
					type: file.type,
					url: stableUrl,
				}

				setUploadedFile(nextUploadedFile)
				onUploadComplete?.(nextUploadedFile)

				return nextUploadedFile
			} catch (error) {
				const errorMessage = getErrorMessage(error)

				const message =
					errorMessage.length > 0
						? errorMessage
						: 'Something went wrong, please try again later.'

				toast.error(message)

				onUploadError?.(error)
				return undefined
			} finally {
				setProgress(0)
				setIsUploading(false)
				setUploadingFile(undefined)
			}
		},
		[
			generateUploadUrl,
			onUploadBegin,
			onUploadComplete,
			onUploadError,
			onUploadProgress,
			syncMetadata,
		],
	)

	return {
		isUploading,
		progress,
		uploadedFile,
		uploadFile,
		uploadingFile,
	}
}

export function getErrorMessage(err: unknown) {
	const unknownError = 'Something went wrong, please try again later.'

	if (err instanceof z.ZodError) {
		const errors = err.issues.map((issue) => issue.message)

		return errors.join('\n')
	}
	if (err instanceof Error) {
		return err.message
	}
	return unknownError
}

export function showErrorToast(err: unknown) {
	const errorMessage = getErrorMessage(err)

	return toast.error(errorMessage)
}
