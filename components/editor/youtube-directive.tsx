'use client'

import { Delete02Icon, YoutubeIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
	ButtonWithTooltip,
	type DirectiveDescriptor,
	type DirectiveEditorProps,
	insertDirective$,
	useLexicalNodeRemove,
	useMdastNodeUpdater,
	usePublisher,
} from '@mdxeditor/editor'
import type { LeafDirective } from 'mdast-util-directive'
import { useId, useState } from 'react'
import { YoutubeEmbed } from '@/components/editor/youtube-embed'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getYoutubeVideoId, getYoutubeWatchUrl } from '@/lib/youtube'

function YoutubeDirectiveEditor({
	mdastNode,
}: DirectiveEditorProps<LeafDirective>) {
	const storedVideoId = mdastNode.attributes?.id ?? ''
	const [url, setUrl] = useState(
		storedVideoId ? getYoutubeWatchUrl(storedVideoId) : '',
	)
	const [error, setError] = useState<string | null>(null)
	const removeNode = useLexicalNodeRemove()
	const updateMdastNode = useMdastNodeUpdater<LeafDirective>()

	const updateVideo = () => {
		const videoId = getYoutubeVideoId(url)
		if (!videoId) {
			setError('Enter a valid YouTube video, Short, live, or embed URL.')
			return
		}

		setError(null)
		setUrl(getYoutubeWatchUrl(videoId))
		updateMdastNode({
			attributes: {
				...mdastNode.attributes,
				id: videoId,
			},
		})
	}

	return (
		<div className="bedrock-youtube-editor">
			<YoutubeEmbed
				className="bedrock-youtube-embed"
				title="YouTube video preview"
				videoId={storedVideoId}
			/>
			<div className="flex flex-col gap-2 border-t bg-muted/40 p-3 sm:flex-row sm:items-start">
				<div className="min-w-0 flex-1">
					<Input
						aria-invalid={Boolean(error)}
						aria-label="YouTube video URL"
						onBlur={updateVideo}
						onChange={(event) => {
							setUrl(event.target.value)
							setError(null)
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault()
								updateVideo()
							}
						}}
						placeholder="https://www.youtube.com/watch?v=..."
						type="url"
						value={url}
					/>
					{error && (
						<p className="mt-1.5 text-destructive text-xs">
							{error}
						</p>
					)}
				</div>
				<Button
					aria-label="Remove YouTube video"
					onClick={removeNode}
					size="icon"
					type="button"
					variant="destructive"
				>
					<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
				</Button>
			</div>
		</div>
	)
}

export const YoutubeDirectiveDescriptor: DirectiveDescriptor<LeafDirective> = {
	attributes: ['id'],
	Editor: YoutubeDirectiveEditor,
	hasChildren: false,
	name: 'youtube',
	testNode: (node): node is LeafDirective =>
		node.name === 'youtube' && node.type === 'leafDirective',
	type: 'leafDirective',
}

export function InsertYoutube() {
	const insertDirective = usePublisher(insertDirective$)
	const [open, setOpen] = useState(false)
	const [url, setUrl] = useState('')
	const [error, setError] = useState<string | null>(null)
	const youtubeUrlId = useId()
	const youtubeErrorId = `${youtubeUrlId}-error`

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			setUrl('')
			setError(null)
		}
	}

	const embedVideo = () => {
		const videoId = getYoutubeVideoId(url)
		if (!videoId) {
			setError('Enter a valid YouTube video, Short, live, or embed URL.')
			return
		}

		insertDirective({
			attributes: { id: videoId },
			name: 'youtube',
			type: 'leafDirective',
		})
		handleOpenChange(false)
	}

	return (
		<>
			<ButtonWithTooltip
				onClick={() => setOpen(true)}
				title="Embed YouTube video"
			>
				<HugeiconsIcon icon={YoutubeIcon} size={18} strokeWidth={2} />
			</ButtonWithTooltip>
			<Dialog onOpenChange={handleOpenChange} open={open}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault()
							embedVideo()
						}}
					>
						<DialogHeader>
							<DialogTitle>Embed YouTube video</DialogTitle>
							<DialogDescription>
								Paste a YouTube video, Short, live, or embed
								URL.
							</DialogDescription>
						</DialogHeader>
						<div className="mt-6 grid gap-2">
							<Label htmlFor={youtubeUrlId}>YouTube URL</Label>
							<Input
								aria-describedby={
									error ? youtubeErrorId : undefined
								}
								aria-invalid={Boolean(error)}
								autoFocus
								id={youtubeUrlId}
								onChange={(event) => {
									setUrl(event.target.value)
									setError(null)
								}}
								placeholder="https://www.youtube.com/watch?v=..."
								type="url"
								value={url}
							/>
							{error && (
								<p
									className="text-destructive text-xs"
									id={youtubeErrorId}
								>
									{error}
								</p>
							)}
						</div>
						<DialogFooter className="mt-6">
							<Button
								onClick={() => handleOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button type="submit">Embed video</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	)
}
