'use client'

import { Cancel01Icon, Upload03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
	FileUpload,
	FileUploadDropzone,
	FileUploadItem,
	FileUploadItemDelete,
	FileUploadItemMetadata,
	FileUploadItemProgress,
	FileUploadList,
	type FileUploadProps,
	FileUploadTrigger,
} from '@/components/dice-ui/file-upload'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

const VERSION_FILE_ACCEPT = '.mcpack,.mcworld,.mcaddon,.zip,.mctemplate'
const MAX_FILE_SIZE = 256 * 1024 * 1024 // 256 MB

interface VersionFileUploadProps {
	projectId: Id<'projects'>
	version: string
	/** Called once the file is uploaded and metadata synced */
	onUploadComplete: (
		r2Key: string,
		fileName: string,
		fileSize: number,
	) => void
	/** Called when the staged file is removed before the form is submitted */
	onUploadRemoved: () => void
	disabled?: boolean
}

export function VersionFileUpload({
	projectId,
	version,
	onUploadComplete,
	onUploadRemoved,
	disabled,
}: VersionFileUploadProps) {
	const [files, setFiles] = useState<File[]>([])
	const generateUploadUrl = useMutation(
		api.functions.projects.versions.generateVersionUploadUrl,
	)
	const syncMetadata = useMutation(api.lib.r2.syncMetadata)

	const onUpload: NonNullable<FileUploadProps['onUpload']> = useCallback(
		async (uploadedFiles, { onProgress }) => {
			const file = uploadedFiles[0]
			if (!file) {
				return
			}

			try {
				// 1. Get presigned PUT URL with the structured object key
				const { key, url } = await generateUploadUrl({
					projectId,
					version,
					fileName: file.name,
				})

				// 2. Upload directly to R2 via XHR so we get progress events
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest()
					xhr.upload.onprogress = (e) => {
						if (e.lengthComputable) {
							onProgress(file, (e.loaded / e.total) * 100)
						}
					}
					xhr.onload = () => {
						if (xhr.status >= 200 && xhr.status < 300) {
							resolve()
						} else {
							reject(
								new Error(
									`Upload failed: ${xhr.status} ${xhr.statusText}`,
								),
							)
						}
					}
					xhr.onerror = () =>
						reject(new Error('Network error during upload'))
					xhr.open('PUT', url)
					xhr.setRequestHeader(
						'Content-Type',
						file.type || 'application/octet-stream',
					)
					xhr.send(file)
				})

				// 3. Sync metadata to Convex so it's queryable
				await syncMetadata({ key })

				onUploadComplete(key, file.name, file.size)
			} catch (err) {
				toast.error(
					err instanceof Error
						? err.message
						: 'Upload failed. Please try again.',
				)
				throw err
			}
		},
		[generateUploadUrl, syncMetadata, projectId, version, onUploadComplete],
	)

	const handleFilesChange = useCallback(
		(updated: File[]) => {
			setFiles(updated)
			if (updated.length === 0) {
				onUploadRemoved()
			}
		},
		[onUploadRemoved],
	)

	return (
		<FileUpload
			accept={VERSION_FILE_ACCEPT}
			disabled={disabled}
			maxFiles={1}
			maxSize={MAX_FILE_SIZE}
			onUpload={onUpload}
			onValueChange={handleFilesChange}
			value={files}
		>
			<FileUploadDropzone>
				<div className="flex flex-col items-center gap-1 text-center">
					<div className="flex size-10 items-center justify-center rounded-full border bg-background">
						<HugeiconsIcon
							className="size-5 text-muted-foreground"
							icon={Upload03Icon}
						/>
					</div>
					<p className="font-medium text-sm">
						Drop version file here
					</p>
					<p className="text-muted-foreground text-xs">
						.mcpack, .mcworld, .mcaddon, .mctemplate, .zip &bull; up
						to 256 MB
					</p>
				</div>
				<FileUploadTrigger asChild>
					<Button
						disabled={disabled}
						size="sm"
						type="button"
						variant="outline"
					>
						Browse file
					</Button>
				</FileUploadTrigger>
			</FileUploadDropzone>

			<FileUploadList>
				{files.map((file) => (
					<FileUploadItem
						key={`${file.name}-${file.size}`}
						value={file}
					>
						<FileUploadItemMetadata />
						<FileUploadItemProgress />
						<FileUploadItemDelete asChild>
							<Button
								className="size-7"
								disabled={disabled}
								size="icon"
								type="button"
								variant="ghost"
							>
								<HugeiconsIcon
									className="size-4"
									icon={Cancel01Icon}
								/>
							</Button>
						</FileUploadItemDelete>
					</FileUploadItem>
				))}
			</FileUploadList>
		</FileUpload>
	)
}
