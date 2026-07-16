'use client'

import {
	Alert02Icon,
	ArrowDown02Icon,
	ArrowUp02Icon,
	Cancel01Icon,
	Delete02Icon,
	FloppyDiskIcon,
	Upload03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import { useState } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { uploadFileToPresignedUrl } from '@/lib/r2-upload'

type GalleryKind = 'project' | 'server'

const MAX_GALLERY_IMAGES = 12
const MAX_GALLERY_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
const MAX_GALLERY_CAPTION_LENGTH = 160
const GALLERY_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

interface GalleryManagerProps {
	kind: GalleryKind
	entityId: Id<'projects'> | Id<'servers'>
}

interface GalleryItem {
	_id: Id<'projectGallery'> | Id<'serverGallery'>
	caption?: string
	fileName: string
	fileSize: number
	mimeType: string
	sortOrder: number
	url: string
}

const getFileKey = (file: File) =>
	`${file.name}-${file.size}-${file.lastModified}`

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Something went wrong'
}

export function GalleryManager({ kind, entityId }: GalleryManagerProps) {
	const [files, setFiles] = useState<File[]>([])
	const [pendingAction, setPendingAction] = useState<string | null>(null)
	const [captions, setCaptions] = useState<Record<string, string>>({})
	const [uploadError, setUploadError] = useState<string | null>(null)

	const serverItems = useQuery(
		api.functions.servers.gallery.listMine,
		kind === 'server' ? { serverId: entityId as Id<'servers'> } : 'skip',
	)
	const projectItems = useQuery(
		api.functions.projects.gallery.listMine,
		kind === 'project' ? { projectId: entityId as Id<'projects'> } : 'skip',
	)
	const items = (kind === 'server' ? serverItems : projectItems) as
		| GalleryItem[]
		| undefined
	const imageCount = items?.length ?? 0
	const isAtLimit = imageCount >= MAX_GALLERY_IMAGES

	const generateServerUploadUrl = useMutation(
		api.functions.servers.gallery.generateUploadUrl,
	)
	const generateProjectUploadUrl = useMutation(
		api.functions.projects.gallery.generateUploadUrl,
	)
	const addServerImage = useMutation(api.functions.servers.gallery.add)
	const addProjectImage = useMutation(api.functions.projects.gallery.add)
	const updateServerCaption = useMutation(
		api.functions.servers.gallery.updateCaption,
	)
	const updateProjectCaption = useMutation(
		api.functions.projects.gallery.updateCaption,
	)
	const reorderServerGallery = useMutation(
		api.functions.servers.gallery.reorder,
	)
	const reorderProjectGallery = useMutation(
		api.functions.projects.gallery.reorder,
	)
	const removeServerImage = useMutation(api.functions.servers.gallery.remove)
	const removeProjectImage = useMutation(
		api.functions.projects.gallery.remove,
	)
	const syncMetadata = useMutation(api.lib.r2.syncMetadata)

	const onUpload: NonNullable<FileUploadProps['onUpload']> = async (
		uploadedFiles,
		{ onProgress },
	) => {
		const file = uploadedFiles[0]
		if (!file) {
			return
		}

		setPendingAction('upload')
		setUploadError(null)
		try {
			const uploadTarget =
				kind === 'server'
					? await generateServerUploadUrl({
							serverId: entityId as Id<'servers'>,
							fileName: file.name,
						})
					: await generateProjectUploadUrl({
							projectId: entityId as Id<'projects'>,
							fileName: file.name,
						})

			await uploadFileToPresignedUrl({
				file,
				url: uploadTarget.url,
				onProgress: (progress) => onProgress(file, progress),
			})
			await syncMetadata({ key: uploadTarget.key })

			if (kind === 'server') {
				await addServerImage({
					serverId: entityId as Id<'servers'>,
					r2Key: uploadTarget.key,
					fileName: file.name,
					fileSize: file.size,
					mimeType: file.type || 'application/octet-stream',
				})
			} else {
				await addProjectImage({
					projectId: entityId as Id<'projects'>,
					r2Key: uploadTarget.key,
					fileName: file.name,
					fileSize: file.size,
					mimeType: file.type || 'application/octet-stream',
				})
			}

			setFiles([])
			setUploadError(null)
			toast.success('Gallery image uploaded')
		} catch (error) {
			const message = getErrorMessage(error)
			setUploadError(message)
			toast.error(message)
			throw error
		} finally {
			setPendingAction(null)
		}
	}

	const handleSaveCaption = async (item: GalleryItem) => {
		setPendingAction(`caption:${item._id}`)
		try {
			const caption = captions[item._id] ?? item.caption ?? ''
			if (kind === 'server') {
				await updateServerCaption({
					id: item._id as Id<'serverGallery'>,
					caption,
				})
			} else {
				await updateProjectCaption({
					id: item._id as Id<'projectGallery'>,
					caption,
				})
			}
			toast.success('Caption saved')
		} catch (error) {
			toast.error(getErrorMessage(error))
		} finally {
			setPendingAction(null)
		}
	}

	const handleMove = async (from: number, to: number) => {
		if (!items || to < 0 || to >= items.length) {
			return
		}

		const ordered = [...items]
		const [moved] = ordered.splice(from, 1)
		ordered.splice(to, 0, moved)
		setPendingAction('reorder')
		try {
			if (kind === 'server') {
				await reorderServerGallery({
					serverId: entityId as Id<'servers'>,
					orderedIds: ordered.map(
						(item) => item._id as Id<'serverGallery'>,
					),
				})
			} else {
				await reorderProjectGallery({
					projectId: entityId as Id<'projects'>,
					orderedIds: ordered.map(
						(item) => item._id as Id<'projectGallery'>,
					),
				})
			}
		} catch (error) {
			toast.error(getErrorMessage(error))
		} finally {
			setPendingAction(null)
		}
	}

	const handleRemove = async (item: GalleryItem) => {
		setPendingAction(`delete:${item._id}`)
		try {
			if (kind === 'server') {
				await removeServerImage({ id: item._id as Id<'serverGallery'> })
			} else {
				await removeProjectImage({
					id: item._id as Id<'projectGallery'>,
				})
			}
			toast.success('Gallery image deleted')
		} catch (error) {
			toast.error(getErrorMessage(error))
		} finally {
			setPendingAction(null)
		}
	}

	const renderGalleryContent = () => {
		if (items === undefined) {
			return (
				<div className="grid gap-4 sm:grid-cols-2">
					{['one', 'two'].map((key) => (
						<Skeleton className="h-64 rounded-lg" key={key} />
					))}
				</div>
			)
		}

		if (items.length === 0) {
			return (
				<Empty className="border border-border/70 border-dashed py-12">
					<EmptyHeader>
						<EmptyTitle>No gallery images yet</EmptyTitle>
						<EmptyDescription>
							Upload screenshots to showcase this {kind}.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)
		}

		return (
			<div className="grid gap-4 sm:grid-cols-2">
				{items.map((item, index) => (
					<div
						className="overflow-hidden rounded-lg border bg-card"
						key={item._id}
					>
						<div className="relative aspect-video">
							<Image
								alt={item.caption || item.fileName}
								className="object-cover"
								fill
								sizes="(min-width: 1024px) 30vw, 100vw"
								src={item.url}
							/>
						</div>
						<div className="space-y-3 p-3">
							<Input
								maxLength={MAX_GALLERY_CAPTION_LENGTH}
								onChange={(event) =>
									setCaptions((current) => ({
										...current,
										[item._id]: event.target.value,
									}))
								}
								placeholder="Optional caption"
								value={captions[item._id] ?? item.caption ?? ''}
							/>
							<div className="flex flex-wrap gap-2">
								<Button
									disabled={pendingAction !== null}
									onClick={() => handleSaveCaption(item)}
									size="sm"
									type="button"
									variant="outline"
								>
									<HugeiconsIcon
										className="size-4"
										icon={FloppyDiskIcon}
									/>
									Save
								</Button>
								<Button
									disabled={
										pendingAction !== null || index === 0
									}
									onClick={() => {
										handleMove(index, index - 1)
									}}
									size="icon-sm"
									type="button"
									variant="outline"
								>
									<HugeiconsIcon
										className="size-4"
										icon={ArrowUp02Icon}
									/>
								</Button>
								<Button
									disabled={
										pendingAction !== null ||
										index === items.length - 1
									}
									onClick={() => {
										handleMove(index, index + 1)
									}}
									size="icon-sm"
									type="button"
									variant="outline"
								>
									<HugeiconsIcon
										className="size-4"
										icon={ArrowDown02Icon}
									/>
								</Button>
								<Button
									className="ml-auto"
									disabled={pendingAction !== null}
									onClick={() => {
										handleRemove(item)
									}}
									size="icon-sm"
									type="button"
									variant="destructive"
								>
									<HugeiconsIcon
										className="size-4"
										icon={Delete02Icon}
									/>
								</Button>
							</div>
						</div>
					</div>
				))}
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4 text-sm">
				<p className="font-medium">Gallery images</p>
				<p className="text-muted-foreground tabular-nums">
					{imageCount}/{MAX_GALLERY_IMAGES}
				</p>
			</div>
			<FileUpload
				accept={GALLERY_IMAGE_ACCEPT}
				disabled={pendingAction !== null || isAtLimit}
				invalid={uploadError !== null}
				maxFiles={1}
				maxSize={MAX_GALLERY_IMAGE_SIZE_BYTES}
				onFileAccept={() => setUploadError(null)}
				onFileReject={(file, message) =>
					setUploadError(`${file.name}: ${message}`)
				}
				onUpload={onUpload}
				onValueChange={setFiles}
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
							{isAtLimit ? (
								'Gallery limit reached'
							) : (
								<>
									Drag & drop or{' '}
									<FileUploadTrigger className="text-primary underline">
										browse
									</FileUploadTrigger>
								</>
							)}
						</p>
						<p className="text-muted-foreground text-xs">
							{isAtLimit
								? 'Delete an image before adding another.'
								: 'PNG, JPG, WebP, or GIF up to 8MB'}
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
							<div className="aspect-video w-full overflow-hidden rounded-lg">
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

			{uploadError ? (
				<Alert variant="destructive">
					<HugeiconsIcon icon={Alert02Icon} />
					<AlertDescription>{uploadError}</AlertDescription>
				</Alert>
			) : null}

			{renderGalleryContent()}
		</div>
	)
}
