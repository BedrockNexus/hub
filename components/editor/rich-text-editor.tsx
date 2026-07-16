'use client'

import dynamic from 'next/dynamic'

export interface RichTextEditorProps {
	value?: string
	onChange: (value: string) => void
	placeholder?: string
	disabled?: boolean
}

const MarkdownEditor = dynamic(
	() =>
		import('@/components/editor/initialized-mdx-editor').then(
			(module) => module.InitializedMdxEditor,
		),
	{
		ssr: false,
		loading: () => (
			<div className="min-h-48 rounded-md border bg-background" />
		),
	},
)

export function RichTextEditor(props: RichTextEditorProps) {
	return <MarkdownEditor {...props} />
}
