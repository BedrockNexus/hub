'use client'

import { Cancel01Icon, Upload03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
	FileUpload,
	FileUploadDropzone,
	FileUploadItem,
	FileUploadItemDelete,
	FileUploadItemMetadata,
	FileUploadItemPreview,
	FileUploadItemProgress,
	FileUploadList,
	type FileUploadProps,
	FileUploadTrigger,
} from '@/components/dice-ui/file-upload'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import {
	type R2ImageKind,
	type R2ImageResourceType,
	uploadFileToPresignedUrl,
} from '@/lib/r2-upload'

const getFileKey = (file: File) =>
	`${file.name}-${file.size}-${file.lastModified}`

interface BannerUploadProps {
	/** URL of the current banner image (already resolved) */
	currentImageUrl?: string | null
	/** R2 folder namespace for the image */
	resourceType: R2ImageResourceType
	/** R2 image folder within the resource namespace */
	imageKind: R2ImageKind
	/** Existing server/project id used in the final R2 object path */
	entityId: string
	/** Called with the R2 key when a new banner has been uploaded successfully */
	onUploadComplete: (key: string) => void
	/** Called when the staged upload is removed before saving */
	onUploadRemoved: () => void
	/** Whether the user marked the current banner for removal */
	isRemoved: boolean
	/** Callback to mark the banner for removal */
	onRemove: () => void
	/** Callback to undo removal */
	onUndoRemove: () => void
	/** Whether a current banner exists (to show remove button) */
	hasCurrentImage?: boolean
	/** Whether the upload is disabled (e.g. during submission) */
	disabled?: boolean
	/** Max file size in bytes. Defaults to 5MB */
	maxSize?: number
	/** Size label shown in the dropzone (e.g. "5MB"). Defaults to "5MB" */
	sizeLabel?: string
}

export function BannerUpload({
	currentImageUrl,
	resourceType,
	imageKind,
	entityId,
	onUploadComplete,
	onUploadRemoved,
	isRemoved,
	onRemove,
	onUndoRemove,
	hasCurrentImage,
	disabled,
	maxSize = 5 * 1024 * 1024,
	sizeLabel = '5MB',
}: BannerUploadProps) {
	const [files, setFiles] = useState<File[]>([])
	const generateUploadUrl = useMutation(
		api.functions.storage.generateImageUploadUrl,
	)
	const syncMetadata = useMutation(api.lib.r2.syncMetadata)

	const onUpload: NonNullable<FileUploadProps['onUpload']> = useCallback(
		async (uploadedFiles, { onProgress }) => {
			const file = uploadedFiles[0]
			if (!file) {
				return
			}

			try {
				const { key, url } = await generateUploadUrl({
					resourceType,
					imageKind,
					entityId,
					fileName: file.name,
				})

				await uploadFileToPresignedUrl({
					file,
					url,
					onProgress: (progress) => onProgress(file, progress),
				})
				await syncMetadata({ key })
				onUploadComplete(key)
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : 'Upload failed',
				)
			}
		},
		[
			generateUploadUrl,
			entityId,
			imageKind,
			onUploadComplete,
			resourceType,
			syncMetadata,
		],
	)

	return (
		<div className="space-y-4">
			{/* Current banner preview */}
			{currentImageUrl && !isRemoved && files.length === 0 && (
				<div>
					<div className="relative mb-2 aspect-3/1 w-full overflow-hidden rounded-lg border">
						<Image
							alt="Current banner"
							className="object-cover"
							fill
							src={currentImageUrl}
						/>
					</div>
					{hasCurrentImage && (
						<Button
							onClick={onRemove}
							type="button"
							variant="outline"
						>
							<HugeiconsIcon
								className="mr-2 size-4"
								icon={Cancel01Icon}
							/>
							Remove
						</Button>
					)}
				</div>
			)}

			{/* Removed state */}
			{isRemoved && (
				<div className="flex items-center gap-4">
					<p className="text-muted-foreground text-sm">
						Banner will be removed on save.
					</p>
					<Button
						onClick={onUndoRemove}
						type="button"
						variant="outline"
					>
						Undo
					</Button>
				</div>
			)}

			{/* Dropzone */}
			<FileUpload
				accept="image/*"
				disabled={disabled}
				maxFiles={1}
				maxSize={maxSize}
				onUpload={onUpload}
				onValueChange={(newFiles) => {
					setFiles(newFiles)
					if (newFiles.length === 0) {
						onUploadRemoved()
					}
					if (newFiles.length > 0 && isRemoved) {
						onUndoRemove()
					}
				}}
				value={files}
			>
				<FileUploadDropzone className="flex-row gap-4 border-dashed p-4">
					<div className="flex size-12 items-center justify-center rounded-full border bg-muted">
						<HugeiconsIcon
							className="text-muted-foreground"
							icon={Upload03Icon}
							size={20}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<p className="font-medium text-sm">
							Drag & drop or{' '}
							<FileUploadTrigger className="text-primary underline">
								browse
							</FileUploadTrigger>
						</p>
						<p className="text-muted-foreground text-xs">
							PNG, JPG or GIF up to {sizeLabel}
						</p>
					</div>
				</FileUploadDropzone>
				<FileUploadList>
					{files.map((file) => (
						<FileUploadItem
							className="flex-row flex-wrap gap-4"
							key={getFileKey(file)}
							value={file}
						>
							<div className="aspect-3/1 w-full overflow-hidden rounded-lg">
								<FileUploadItemPreview className="h-full w-full rounded-none border-0" />
							</div>
							<div className="flex flex-1 flex-col gap-1">
								<FileUploadItemMetadata />
							</div>
							<FileUploadItemDelete asChild>
								<Button
									className="size-7"
									size="icon"
									variant="ghost"
								>
									<HugeiconsIcon
										icon={Cancel01Icon}
										size={14}
									/>
								</Button>
							</FileUploadItemDelete>
							<FileUploadItemProgress className="basis-full" />
						</FileUploadItem>
					))}
				</FileUploadList>
			</FileUpload>
		</div>
	)
}
