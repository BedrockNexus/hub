'use client'

import { Delete02Icon, ImageUpload01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { PluginAvatar } from '@/components/plugins/plugin-card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { usePluginIconUpload } from '@/hooks/use-picture-upload'
import { resizeSquareImage } from '@/lib/resize-image'

function errorMessage(error: unknown) {
	if (
		typeof error === 'object' &&
		error !== null &&
		'data' in error &&
		typeof error.data === 'object' &&
		error.data !== null &&
		'message' in error.data &&
		typeof error.data.message === 'string'
	) {
		return error.data.message
	}
	return error instanceof Error
		? error.message
		: 'The icon could not be saved.'
}

/** Upload, replace, or remove a plugin's icon. Saves immediately. */
export function PluginIconField({
	draftId,
	name,
	iconUrl,
	disabled = false,
	published = false,
}: {
	draftId: Id<'pluginPublishingDrafts'>
	name: string
	iconUrl?: string
	disabled?: boolean
	/** A published plugin shows a new icon once its next version is approved. */
	published?: boolean
}) {
	const uploadIcon = usePluginIconUpload()
	const removeIcon = useMutation(api.functions.plugins.icons.remove)
	const inputRef = useRef<HTMLInputElement>(null)
	const [busy, setBusy] = useState(false)

	async function run(operation: () => Promise<void>) {
		setBusy(true)
		try {
			await operation()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="flex items-center gap-4">
			<PluginAvatar avatarUrl={iconUrl} className="size-16" name={name} />
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={disabled || busy}
						onClick={() => inputRef.current?.click()}
						size="sm"
						type="button"
						variant="outline"
					>
						{busy ? (
							<Spinner data-icon="inline-start" />
						) : (
							<HugeiconsIcon
								data-icon="inline-start"
								icon={ImageUpload01Icon}
							/>
						)}
						{iconUrl ? 'Change icon' : 'Upload icon'}
					</Button>
					{iconUrl ? (
						<Button
							disabled={disabled || busy}
							onClick={() =>
								run(async () => {
									await removeIcon({ draftId })
									toast.success('Icon removed.')
								})
							}
							size="sm"
							type="button"
							variant="ghost"
						>
							<HugeiconsIcon
								data-icon="inline-start"
								icon={Delete02Icon}
							/>
							Remove
						</Button>
					) : null}
				</div>
				<p className="text-muted-foreground text-xs">
					Square PNG, JPG, WebP or GIF, up to 1 MB.
					{published
						? ' Shown publicly once your next version is approved.'
						: ''}
				</p>
			</div>
			<input
				accept="image/png,image/jpeg,image/webp,image/gif"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0]
					event.target.value = ''
					if (!file) {
						return
					}
					void run(async () => {
						await uploadIcon(draftId, await resizeSquareImage(file))
						toast.success('Icon saved.')
					})
				}}
				ref={inputRef}
				type="file"
			/>
		</div>
	)
}
