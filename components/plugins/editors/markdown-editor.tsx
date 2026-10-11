'use client'

import dynamic from 'next/dynamic'

import type { MarkdownEditorCoreProps } from '@/components/plugins/editors/markdown-editor-core'

const ClientMarkdownEditor = dynamic(
	() =>
		import('@/components/plugins/editors/markdown-editor-core').then(
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

export function MarkdownEditor(props: MarkdownEditorCoreProps) {
	return <ClientMarkdownEditor {...props} />
}
