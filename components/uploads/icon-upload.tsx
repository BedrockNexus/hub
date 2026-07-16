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
	FileUploadItemPreview,
	FileUploadItemProgress,
	FileUploadList,
	type FileUploadProps,
	FileUploadTrigger,
} from '@/components/dice-ui/file-upload'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import {
	type R2ImageKind,
	type R2ImageResourceType,
	uploadFileToPresignedUrl,
} from '@/lib/r2-upload'

const getFileKey = (file: File) =>
	`${file.name}-${file.size}-${file.lastModified}`

interface IconUploadProps {
	/** URL of the current image (already resolved, not a storage ID) */
	currentImageUrl?: string | null
	/** Name used for alt text and avatar fallback */
	name: string
	/** R2 folder namespace for the image */
	resourceType: R2ImageResourceType
	/** R2 image folder within the resource namespace */
	imageKind: R2ImageKind
	/** Existing server/project id used in the final R2 object path */
	entityId: string
	/** Called with the R2 key when a new image has been uploaded successfully */
	onUploadComplete: (key: string) => void
	/** Called when the staged upload is removed before saving */
	onUploadRemoved: () => void
	/** Whether the user marked the current image for removal */
	isRemoved: boolean
	/** Callback to mark the image for removal */
	onRemove: () => void
	/** Callback to undo removal */
	onUndoRemove: () => void
	/** Whether the current image exists (to show remove button) */
	hasCurrentImage?: boolean
	/** Whether the upload is disabled (e.g. during submission) */
	disabled?: boolean
	/** Max file size in bytes. Defaults to 5MB */
	maxSize?: number
	/** Size label shown in the dropzone (e.g. "2MB"). Defaults to "5MB" */
	sizeLabel?: string
	/** Avatar border-radius style. 'full' for user avatars, 'lg' for org/server logos */
	rounded?: 'full' | 'lg'
	/** URL to show when the image is removed (e.g. vercel avatar fallback) */
	fallbackUrl?: string
}

export function IconUpload({
	currentImageUrl,
	name,
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
	rounded = 'full',
	fallbackUrl,
}: IconUploadProps) {
	const [files, setFiles] = useState<File[]>([])
	const roundedClass = rounded === 'lg' ? 'rounded-lg' : 'rounded-full'
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
			{/* Current image preview */}
			{(currentImageUrl || fallbackUrl) && files.length === 0 && (
				<div className="flex items-center gap-4">
					<Avatar className={`size-20 ${roundedClass}`}>
						<AvatarImage
							alt={name}
							className={`${roundedClass} object-cover`}
							src={
								isRemoved
									? (fallbackUrl ?? undefined)
									: (currentImageUrl ??
										fallbackUrl ??
										undefined)
							}
						/>
						<AvatarFallback className={`${roundedClass} text-2xl`}>
							{name?.charAt(0)?.toUpperCase() || '?'}
						</AvatarFallback>
					</Avatar>
					{hasCurrentImage && !isRemoved && (
						<Button
							onClick={onRemove}
							type="button"
							variant="outline"
						>
							<HugeiconsIcon
								className="mr-2"
								icon={Cancel01Icon}
								size={16}
							/>
							Remove
						</Button>
					)}
					{isRemoved && (
						<Button
							onClick={onUndoRemove}
							type="button"
							variant="outline"
						>
							Undo Remove
						</Button>
					)}
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
							<div className="size-12 overflow-hidden rounded-lg">
								<FileUploadItemPreview />
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
