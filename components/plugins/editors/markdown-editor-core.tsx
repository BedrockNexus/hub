'use client'

import {
	BlockTypeSelect,
	BoldItalicUnderlineToggles,
	CodeToggle,
	CreateLink,
	codeBlockPlugin,
	headingsPlugin,
	InsertCodeBlock,
	InsertThematicBreak,
	ListsToggle,
	linkDialogPlugin,
	linkPlugin,
	listsPlugin,
	MDXEditor,
	type MDXEditorMethods,
	markdownShortcutPlugin,
	quotePlugin,
	Separator,
	thematicBreakPlugin,
	toolbarPlugin,
	UndoRedo,
} from '@mdxeditor/editor'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

export interface MarkdownEditorCoreProps {
	value: string
	onChange: (value: string) => void
	labelledBy?: string
	placeholder?: string
	disabled?: boolean
	className?: string
	maximumLength?: number
}

export function MarkdownEditorCore({
	value,
	onChange,
	labelledBy,
	placeholder = 'Write a detailed project description…',
	disabled = false,
	className,
	maximumLength,
}: MarkdownEditorCoreProps) {
	const editorRef = useRef<MDXEditorMethods>(null)
	const lastEditorValue = useRef(value)

	useEffect(() => {
		if (
			value !== lastEditorValue.current &&
			editorRef.current?.getMarkdown() !== value
		) {
			lastEditorValue.current = value
			editorRef.current?.setMarkdown(value)
		}
	}, [value])

	return (
		<fieldset
			aria-labelledby={labelledBy}
			className={cn(
				'overflow-hidden rounded-md border bg-background',
				className,
			)}
			disabled={disabled}
		>
			<MDXEditor
				className="bedrock-markdown-editor"
				contentEditableClassName="bedrock-markdown-content"
				markdown={value}
				onChange={(markdown) => {
					lastEditorValue.current = markdown
					onChange(markdown)
				}}
				placeholder={placeholder}
				plugins={[
					headingsPlugin(),
					listsPlugin(),
					quotePlugin(),
					thematicBreakPlugin(),
					linkPlugin(),
					linkDialogPlugin(),
					codeBlockPlugin(),
					markdownShortcutPlugin(),
					toolbarPlugin({
						toolbarContents: () => (
							<>
								<UndoRedo />
								<Separator />
								<BlockTypeSelect />
								<Separator />
								<BoldItalicUnderlineToggles />
								<CodeToggle />
								<Separator />
								<ListsToggle />
								<CreateLink />
								<InsertCodeBlock />
								<InsertThematicBreak />
							</>
						),
					}),
				]}
				readOnly={disabled}
				ref={editorRef}
				suppressHtmlProcessing
			/>
			{maximumLength ? (
				<div
					className={cn(
						'border-t px-3 py-2 text-right text-muted-foreground text-xs',
						value.length > maximumLength && 'text-destructive',
					)}
				>
					{value.length.toLocaleString()} /{' '}
					{maximumLength.toLocaleString()}
				</div>
			) : null}
		</fieldset>
	)
}
