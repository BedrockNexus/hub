'use client'

import dynamic from 'next/dynamic'

import type { MarkdownEditorProps } from '@/components/editor/markdown-editor-core'

const ClientMarkdownEditor = dynamic(
	() =>
		import('@/components/editor/markdown-editor-core').then(
			(module) => module.MarkdownEditorCore,
		),
	{
		loading: () => (
			<div
				aria-hidden="true"
				className="min-h-72 animate-pulse rounded-md border bg-muted"
			/>
		),
		ssr: false,
	},
)

/** The Markdown editor for descriptions and changelogs; loads on demand. */
export function MarkdownEditor(props: MarkdownEditorProps) {
	return <ClientMarkdownEditor {...props} />
}
