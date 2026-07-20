'use client'

import {
	BlockTypeSelect,
	BoldItalicUnderlineToggles,
	CodeToggle,
	CreateLink,
	codeBlockPlugin,
	codeMirrorPlugin,
	DiffSourceToggleWrapper,
	diffSourcePlugin,
	directivesPlugin,
	headingsPlugin,
	InsertCodeBlock,
	InsertImage,
	InsertTable,
	InsertThematicBreak,
	imagePlugin,
	ListsToggle,
	linkDialogPlugin,
	linkPlugin,
	listsPlugin,
	MDXEditor,
	type MDXEditorMethods,
	markdownShortcutPlugin,
	quotePlugin,
	type RealmPlugin,
	Separator,
	StrikeThroughSupSubToggles,
	tablePlugin,
	thematicBreakPlugin,
	toolbarPlugin,
	UndoRedo,
} from '@mdxeditor/editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { RichTextEditorProps } from '@/components/editor/rich-text-editor'
import {
	InsertYoutube,
	YoutubeDirectiveDescriptor,
} from '@/components/editor/youtube-directive'
import { useUploadFile } from '@/hooks/use-upload-file'
import { cn } from '@/lib/utils'

const MAX_EDITOR_IMAGE_SIZE_BYTES = 4 * 1024 * 1024

const codeBlockLanguages = {
	bash: 'Shell',
	css: 'CSS',
	html: 'HTML',
	javascript: 'JavaScript',
	json: 'JSON',
	markdown: 'Markdown',
	text: 'Plain text',
	tsx: 'TSX',
	typescript: 'TypeScript',
	yaml: 'YAML',
}

function MarkdownToolbar() {
	return (
		<DiffSourceToggleWrapper options={['rich-text', 'source']}>
			<UndoRedo />
			<Separator />
			<BlockTypeSelect />
			<BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
			<StrikeThroughSupSubToggles options={['Strikethrough']} />
			<CodeToggle />
			<Separator />
			<ListsToggle />
			<CreateLink />
			<InsertImage />
			<InsertYoutube />
			<InsertTable />
			<InsertCodeBlock />
			<InsertThematicBreak />
		</DiffSourceToggleWrapper>
	)
}

export function InitializedMdxEditor({
	value,
	onChange,
	placeholder = 'Write something...',
	disabled,
}: RichTextEditorProps) {
	const normalizedValue = value ?? ''
	const editorRef = useRef<MDXEditorMethods>(null)
	const [overlayContainer, setOverlayContainer] =
		useState<HTMLDivElement | null>(null)
	const lastMarkdownRef = useRef(normalizedValue)
	const { uploadFile } = useUploadFile()

	useEffect(() => {
		if (normalizedValue === lastMarkdownRef.current) {
			return
		}

		lastMarkdownRef.current = normalizedValue
		editorRef.current?.setMarkdown(normalizedValue)
	}, [normalizedValue])

	const imageUploadHandler = useCallback(
		async (file: File) => {
			if (!file.type.startsWith('image/')) {
				throw new Error('Only image uploads are supported here.')
			}

			if (file.size > MAX_EDITOR_IMAGE_SIZE_BYTES) {
				throw new Error('Images must be 4MB or smaller.')
			}

			const uploadedFile = await uploadFile(file)
			if (!uploadedFile) {
				throw new Error('Image upload failed.')
			}

			return uploadedFile.appUrl
		},
		[uploadFile],
	)

	const plugins = useMemo<RealmPlugin[]>(
		() => [
			headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
			listsPlugin(),
			quotePlugin(),
			thematicBreakPlugin(),
			linkPlugin(),
			linkDialogPlugin(),
			tablePlugin(),
			codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
			codeMirrorPlugin({
				autoLoadLanguageSupport: false,
				codeBlockLanguages,
			}),
			imagePlugin({
				disableImageResize: true,
				imageUploadHandler,
			}),
			directivesPlugin({
				directiveDescriptors: [YoutubeDirectiveDescriptor],
				escapeUnknownTextDirectives: true,
			}),
			diffSourcePlugin({ viewMode: 'rich-text' }),
			toolbarPlugin({ toolbarContents: MarkdownToolbar }),
			markdownShortcutPlugin(),
		],
		[imageUploadHandler],
	)

	return (
		<div
			className={cn(
				'bedrock-markdown-editor',
				disabled && 'bedrock-markdown-editor-disabled',
			)}
			ref={setOverlayContainer}
		>
			<MDXEditor
				className="bedrock-markdown-editor-root"
				contentEditableClassName="bedrock-markdown-editor-content"
				markdown={normalizedValue}
				onChange={(nextMarkdown, initialMarkdownNormalize) => {
					lastMarkdownRef.current = nextMarkdown
					if (!initialMarkdownNormalize) {
						onChange(nextMarkdown)
					}
				}}
				onError={({ error }) => {
					toast.error(error || 'Markdown could not be parsed.')
				}}
				overlayContainer={overlayContainer}
				placeholder={placeholder}
				plugins={plugins}
				readOnly={disabled}
				ref={editorRef}
				spellCheck
				suppressHtmlProcessing
				trim={false}
			/>
		</div>
	)
}
