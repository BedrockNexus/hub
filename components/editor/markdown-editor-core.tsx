'use client'

import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import {
	CheckListIcon,
	Heading01Icon,
	Image01Icon,
	LeftToRightBlockQuoteIcon,
	LeftToRightListBulletIcon,
	LeftToRightListNumberIcon,
	Link01Icon,
	SourceCodeIcon,
	Table01Icon,
	TextBoldIcon,
	TextItalicIcon,
	TextStrikethroughIcon,
	YoutubeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import CodeMirror, {
	EditorSelection,
	EditorView,
	keymap,
	type ReactCodeMirrorRef,
} from '@uiw/react-codemirror'
import { useTheme } from 'next-themes'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { IconType } from '@/components/detail/detail-parts'
import {
	type RelativeUrlBase,
	RichTextViewer,
} from '@/components/editor/rich-text-viewer'
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
import { useUploadFile } from '@/hooks/use-upload-file'
import { cn } from '@/lib/utils'
import { getYoutubeVideoId } from '@/lib/youtube'

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024

function reportUploadError(error: unknown) {
	toast.error(error instanceof Error ? error.message : 'Image upload failed.')
}

export interface MarkdownEditorProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	disabled?: boolean
	/** Shows a counter; saving longer text is refused by validation. */
	maxLength?: number
	labelledBy?: string
	/** Paste, drop or pick images to upload them into the text. */
	allowImageUpload?: boolean
	/** Where relative links in the preview point, as on the public page. */
	relativeUrlBase?: RelativeUrlBase
	minHeight?: string
	className?: string
}

// --- Editing commands -------------------------------------------------------

/** Wraps each selection, or inserts `placeholder` wrapped and selected. */
function wrap(
	view: EditorView,
	before: string,
	after = before,
	placeholder = '',
) {
	view.dispatch(
		view.state.changeByRange((range) => {
			const text =
				view.state.sliceDoc(range.from, range.to) || placeholder
			return {
				changes: {
					from: range.from,
					to: range.to,
					insert: `${before}${text}${after}`,
				},
				range: EditorSelection.range(
					range.from + before.length,
					range.from + before.length + text.length,
				),
			}
		}),
	)
	view.focus()
}

/**
 * Adds a prefix such as `> ` or `1. ` to every selected line, or removes it
 * when every line already has one (`existing` matches it), as GitHub does.
 */
function toggleLinePrefix(
	view: EditorView,
	prefix: (index: number) => string,
	existing: RegExp,
) {
	const { state } = view
	const lines: { from: number; text: string }[] = []
	const seen = new Set<number>()
	for (const range of state.selection.ranges) {
		const first = state.doc.lineAt(range.from).number
		const last = state.doc.lineAt(range.to).number
		for (let number = first; number <= last; number++) {
			if (!seen.has(number)) {
				seen.add(number)
				lines.push(state.doc.line(number))
			}
		}
	}
	const remove = lines.every((line) => existing.test(line.text))
	view.dispatch({
		changes: lines.map((line, index) =>
			remove
				? {
						from: line.from,
						to:
							line.from +
							(existing.exec(line.text)?.[0].length ?? 0),
					}
				: { from: line.from, insert: prefix(index) },
		),
	})
	view.focus()
}

const HEADING_PREFIX = /^#{1,6} /
const QUOTE_PREFIX = /^> ?/
const BULLET_PREFIX = /^[-*] (?!\[[ xX]\] )/
const NUMBER_PREFIX = /^\d+\. /
const TASK_PREFIX = /^[-*] \[[ xX]\] /

/** Inserts a block on its own lines after the cursor's line. */
function insertBlock(view: EditorView, text: string) {
	const { state } = view
	const line = state.doc.lineAt(state.selection.main.head)
	const atEmptyLine = line.text.trim() === ''
	const from = atEmptyLine ? line.from : line.to
	const insert = `${atEmptyLine ? '' : '\n\n'}${text}\n`
	view.dispatch({
		changes: { from, to: atEmptyLine ? line.to : from, insert },
		selection: { anchor: from + insert.length },
	})
	view.focus()
}

function insertText(view: EditorView, text: string, at?: number) {
	const position = at ?? view.state.selection.main.head
	view.dispatch({
		changes: { from: position, insert: text },
		selection: { anchor: position + text.length },
	})
	view.focus()
}

const TABLE_TEMPLATE =
	'| Column | Column |\n| ------ | ------ |\n| Cell   | Cell   |'

/** A key binding that runs an editing command. */
function bind(key: string, command: (view: EditorView) => void) {
	return {
		key,
		run: (view: EditorView) => {
			command(view)
			return true
		},
	}
}

const shortcuts = keymap.of([
	bind('Mod-b', (view) => wrap(view, '**', '**', 'bold text')),
	bind('Mod-i', (view) => wrap(view, '_', '_', 'italic text')),
	bind('Mod-k', (view) => wrap(view, '[', '](https://)', 'link text')),
	bind('Mod-e', (view) => wrap(view, '`', '`', 'code')),
])

const FILE_EXTENSION = /\.[^.]+$/
const LINK_BRACKETS = /[[\]]/g

const editorTheme = EditorView.theme({
	'&': {
		backgroundColor: 'var(--background)',
		color: 'var(--foreground)',
		fontSize: '0.875rem',
	},
	'.cm-content': {
		caretColor: 'var(--foreground)',
		fontFamily: 'var(--font-mono-family), monospace',
		lineHeight: '1.5rem',
		padding: '0.75rem',
	},
	'.cm-placeholder': { color: 'var(--muted-foreground)' },
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
		backgroundColor: 'color-mix(in oklab, var(--primary) 35%, transparent)',
	},
	'&.cm-focused': { outline: 'none' },
	'.cm-cursor': { borderLeftColor: 'var(--foreground)' },
})

// --- Component ----------------------------------------------------------------

type Tab = 'write' | 'preview'

function ToolbarButton({
	label,
	icon,
	onClick,
	disabled,
}: {
	label: string
	icon: IconType
	onClick: () => void
	disabled?: boolean
}) {
	return (
		<Button
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			size="icon-sm"
			title={label}
			type="button"
			variant="ghost"
		>
			<HugeiconsIcon className="size-4" icon={icon} />
		</Button>
	)
}

/**
 * A Markdown editor laid out like GitHub's: write the text itself, with a
 * toolbar and shortcuts, and preview it exactly as the public page shows it.
 * The text is never rewritten, so HTML, alerts and tables stay as written.
 */
export function MarkdownEditorCore({
	value,
	onChange,
	placeholder = 'Write in Markdown…',
	disabled = false,
	maxLength,
	labelledBy,
	allowImageUpload = false,
	relativeUrlBase,
	minHeight = '18rem',
	className,
}: MarkdownEditorProps) {
	const editorRef = useRef<ReactCodeMirrorRef>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [tab, setTab] = useState<Tab>('write')
	const [youtubeOpen, setYoutubeOpen] = useState(false)
	const [youtubeUrl, setYoutubeUrl] = useState('')
	const { uploadFile, isUploading } = useUploadFile()
	const { resolvedTheme } = useTheme()
	const isDark = resolvedTheme === 'dark'

	const run = (command: (view: EditorView) => void) => {
		const view = editorRef.current?.view
		if (view && !disabled) {
			command(view)
		}
	}

	const uploadImages = async (
		files: File[],
		view: EditorView,
		at?: number,
	) => {
		let position = at ?? view.state.selection.main.head
		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				toast.error(`${file.name} is not an image.`)
				continue
			}
			if (file.size > MAX_IMAGE_SIZE_BYTES) {
				toast.error(`${file.name} is larger than 4MB.`)
				continue
			}
			const uploaded = await uploadFile(file)
			if (uploaded) {
				const alt = file.name
					.replace(FILE_EXTENSION, '')
					.replace(LINK_BRACKETS, '')
				const text = `![${alt}](${uploaded.appUrl})\n`
				insertText(view, text, position)
				position += text.length
			}
		}
	}

	// Rebuilt only when uploads are switched on or off.
	// biome-ignore lint/correctness/useExhaustiveDependencies: uploadImages reads the latest view when called.
	const extensions = useMemo(
		() => [
			markdown({ base: markdownLanguage, codeLanguages: languages }),
			EditorView.lineWrapping,
			editorTheme,
			// The default colours are for light backgrounds.
			...(isDark ? [syntaxHighlighting(oneDarkHighlightStyle)] : []),
			shortcuts,
			...(allowImageUpload
				? [
						EditorView.domEventHandlers({
							paste: (event, view) => {
								const files = [
									...(event.clipboardData?.files ?? []),
								]
								if (files.length === 0) {
									return false
								}
								event.preventDefault()
								uploadImages(files, view).catch(
									reportUploadError,
								)
								return true
							},
							drop: (event, view) => {
								const files = [
									...(event.dataTransfer?.files ?? []),
								]
								if (files.length === 0) {
									return false
								}
								event.preventDefault()
								const at =
									view.posAtCoords({
										x: event.clientX,
										y: event.clientY,
									}) ?? undefined
								uploadImages(files, view, at).catch(
									reportUploadError,
								)
								return true
							},
						}),
					]
				: []),
		],
		[allowImageUpload, isDark],
	)

	const insertYoutube = () => {
		const videoId = getYoutubeVideoId(youtubeUrl)
		if (!videoId) {
			toast.error('Paste a YouTube video link.')
			return
		}
		run((view) => insertBlock(view, `::youtube{id="${videoId}"}`))
		setYoutubeUrl('')
		setYoutubeOpen(false)
	}

	const tools: { label: string; icon: IconType; command: () => void }[][] = [
		[
			{
				label: 'Heading',
				icon: Heading01Icon,
				command: () =>
					run((view) =>
						toggleLinePrefix(view, () => '### ', HEADING_PREFIX),
					),
			},
			{
				label: 'Bold (Ctrl+B)',
				icon: TextBoldIcon,
				command: () =>
					run((view) => wrap(view, '**', '**', 'bold text')),
			},
			{
				label: 'Italic (Ctrl+I)',
				icon: TextItalicIcon,
				command: () =>
					run((view) => wrap(view, '_', '_', 'italic text')),
			},
			{
				label: 'Strikethrough',
				icon: TextStrikethroughIcon,
				command: () => run((view) => wrap(view, '~~', '~~', 'text')),
			},
		],
		[
			{
				label: 'Quote',
				icon: LeftToRightBlockQuoteIcon,
				command: () =>
					run((view) =>
						toggleLinePrefix(view, () => '> ', QUOTE_PREFIX),
					),
			},
			{
				label: 'Code (Ctrl+E)',
				icon: SourceCodeIcon,
				command: () => run((view) => wrap(view, '`', '`', 'code')),
			},
			{
				label: 'Link (Ctrl+K)',
				icon: Link01Icon,
				command: () =>
					run((view) => wrap(view, '[', '](https://)', 'link text')),
			},
		],
		[
			{
				label: 'Bulleted list',
				icon: LeftToRightListBulletIcon,
				command: () =>
					run((view) =>
						toggleLinePrefix(view, () => '- ', BULLET_PREFIX),
					),
			},
			{
				label: 'Numbered list',
				icon: LeftToRightListNumberIcon,
				command: () =>
					run((view) =>
						toggleLinePrefix(
							view,
							(index) => `${index + 1}. `,
							NUMBER_PREFIX,
						),
					),
			},
			{
				label: 'Task list',
				icon: CheckListIcon,
				command: () =>
					run((view) =>
						toggleLinePrefix(view, () => '- [ ] ', TASK_PREFIX),
					),
			},
		],
		[
			{
				label: 'Table',
				icon: Table01Icon,
				command: () => run((view) => insertBlock(view, TABLE_TEMPLATE)),
			},
			{
				label: allowImageUpload ? 'Upload an image' : 'Image',
				icon: Image01Icon,
				command: () =>
					allowImageUpload
						? fileInputRef.current?.click()
						: run((view) =>
								wrap(view, '![', '](https://)', 'description'),
							),
			},
			{
				label: 'YouTube video',
				icon: YoutubeIcon,
				command: () => setYoutubeOpen(true),
			},
		],
	]

	const overLimit = maxLength !== undefined && value.length > maxLength
	let hint = 'Markdown supported.'
	if (isUploading) {
		hint = 'Uploading image…'
	} else if (allowImageUpload) {
		hint = 'Markdown supported. Paste or drop images to upload them.'
	}

	return (
		<fieldset
			aria-labelledby={labelledBy}
			className={cn(
				'min-w-0 overflow-hidden rounded-md border bg-background focus-within:border-ring',
				disabled && 'opacity-60',
				className,
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-2 py-1.5">
				<div className="flex gap-1" role="tablist">
					{(['write', 'preview'] as const).map((name) => (
						<button
							aria-selected={tab === name}
							className={cn(
								'rounded-sm px-3 py-1 font-medium text-sm capitalize transition-colors',
								tab === name
									? 'bg-background text-foreground shadow-xs'
									: 'text-muted-foreground hover:text-foreground',
							)}
							key={name}
							onClick={() => setTab(name)}
							role="tab"
							type="button"
						>
							{name}
						</button>
					))}
				</div>
				{tab === 'write' ? (
					<div className="flex flex-wrap items-center">
						{tools.map((group, index) => (
							<div
								className={cn(
									'flex items-center',
									index > 0 && 'ml-1 border-l pl-1',
								)}
								// biome-ignore lint/suspicious/noArrayIndexKey: the groups are fixed.
								key={index}
							>
								{group.map((tool) => (
									<ToolbarButton
										disabled={disabled}
										icon={tool.icon}
										key={tool.label}
										label={tool.label}
										onClick={tool.command}
									/>
								))}
							</div>
						))}
					</div>
				) : null}
			</div>

			{tab === 'write' ? (
				<CodeMirror
					basicSetup={{
						lineNumbers: false,
						foldGutter: false,
						highlightActiveLine: false,
						highlightActiveLineGutter: false,
						autocompletion: false,
					}}
					editable={!disabled}
					extensions={extensions}
					minHeight={minHeight}
					onChange={onChange}
					placeholder={placeholder}
					readOnly={disabled}
					ref={editorRef}
					theme="none"
					value={value}
				/>
			) : (
				<div className="p-4" style={{ minHeight }}>
					{value.trim() ? (
						<RichTextViewer
							content={value}
							relativeUrlBase={relativeUrlBase}
						/>
					) : (
						<p className="text-muted-foreground text-sm">
							Nothing to preview.
						</p>
					)}
				</div>
			)}

			<div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-1.5 text-muted-foreground text-xs">
				<span>{hint}</span>
				{maxLength === undefined ? null : (
					<span
						className={cn(
							'font-mono',
							overLimit && 'text-destructive',
						)}
					>
						{value.length.toLocaleString()}/
						{maxLength.toLocaleString()}
					</span>
				)}
			</div>

			{allowImageUpload ? (
				<input
					accept="image/png,image/jpeg,image/webp,image/gif"
					className="hidden"
					multiple
					onChange={(event) => {
						const files = [...(event.target.files ?? [])]
						event.target.value = ''
						const view = editorRef.current?.view
						if (view && files.length > 0) {
							uploadImages(files, view).catch(reportUploadError)
						}
					}}
					ref={fileInputRef}
					type="file"
				/>
			) : null}

			<Dialog onOpenChange={setYoutubeOpen} open={youtubeOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Embed a YouTube video</DialogTitle>
						<DialogDescription>
							Paste the video’s link. It plays on the page with
							YouTube’s privacy-enhanced mode.
						</DialogDescription>
					</DialogHeader>
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault()
							insertYoutube()
						}}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="markdown-youtube-url">
								Video link
							</Label>
							<Input
								id="markdown-youtube-url"
								onChange={(event) =>
									setYoutubeUrl(event.target.value)
								}
								placeholder="https://www.youtube.com/watch?v=…"
								value={youtubeUrl}
							/>
						</div>
						<DialogFooter>
							<Button
								onClick={() => setYoutubeOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button type="submit">Insert</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</fieldset>
	)
}
