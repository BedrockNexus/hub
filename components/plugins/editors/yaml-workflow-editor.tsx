'use client'

import { yaml } from '@codemirror/lang-yaml'
import { type Diagnostic, linter } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { useTheme } from 'next-themes'
import { parseDocument } from 'yaml'

import { validateWorkflowTemplate } from '@/lib/plugins/adapters/workflow-templates'
import { cn } from '@/lib/utils'

interface YamlWorkflowEditorProps {
	value: string
	onChange: (value: string) => void
	labelledBy?: string
	disabled?: boolean
	className?: string
	minHeight?: string
}

export function getWorkflowTemplateValidationError(value: string) {
	try {
		validateWorkflowTemplate(value)
		return null
	} catch (error) {
		return error instanceof Error
			? error.message
			: 'The workflow template is invalid.'
	}
}

const workflowLinter = linter(
	(view) => {
		const source = view.state.doc.toString()
		const parsed = parseDocument(source)
		const diagnostics: Diagnostic[] = parsed.errors.map((error) => ({
			from: Math.min(error.pos[0], source.length),
			to: Math.min(
				Math.max(error.pos[1], error.pos[0] + 1),
				source.length,
			),
			severity: 'error',
			message: error.message,
		}))

		if (diagnostics.length === 0) {
			const message = getWorkflowTemplateValidationError(source)
			if (message) {
				diagnostics.push({
					from: 0,
					to: Math.min(1, source.length),
					severity: 'error',
					message,
				})
			}
		}

		return diagnostics
	},
	{ delay: 250 },
)

const lightTheme = EditorView.theme({
	'&': {
		backgroundColor: 'var(--background)',
		color: 'var(--foreground)',
		fontSize: '0.75rem',
	},
	'.cm-content': {
		caretColor: 'var(--foreground)',
		fontFamily: 'var(--font-mono-family), monospace',
		lineHeight: '1.25rem',
		padding: '0.75rem 0',
	},
	'.cm-gutters': {
		backgroundColor: 'var(--muted)',
		borderRight: '1px solid var(--border)',
		color: 'var(--muted-foreground)',
	},
	'.cm-activeLine, .cm-activeLineGutter': {
		backgroundColor: 'color-mix(in oklab, var(--primary) 18%, transparent)',
	},
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
		backgroundColor: 'color-mix(in oklab, var(--primary) 45%, transparent)',
	},
	'&.cm-focused': {
		outline: '2px solid color-mix(in oklab, var(--ring) 50%, transparent)',
		outlineOffset: '-2px',
	},
})

const darkTheme = EditorView.theme(
	{
		'&': {
			backgroundColor: 'var(--background)',
			color: 'var(--foreground)',
		},
		'.cm-gutters': {
			backgroundColor: 'var(--muted)',
			color: 'var(--muted-foreground)',
		},
	},
	{ dark: true },
)

export function YamlWorkflowEditor({
	value,
	onChange,
	labelledBy,
	disabled = false,
	className,
	minHeight = '32rem',
}: YamlWorkflowEditorProps) {
	const { resolvedTheme } = useTheme()
	const validationError = getWorkflowTemplateValidationError(value)

	return (
		<fieldset
			aria-labelledby={labelledBy}
			className={cn(
				'overflow-hidden rounded-md border bg-background',
				className,
			)}
			disabled={disabled}
		>
			<CodeMirror
				basicSetup={{
					bracketMatching: true,
					closeBrackets: true,
					foldGutter: true,
					highlightActiveLine: true,
					highlightActiveLineGutter: true,
					highlightSelectionMatches: true,
					lineNumbers: true,
					searchKeymap: true,
				}}
				editable={!disabled}
				extensions={[yaml(), workflowLinter]}
				height={minHeight}
				onChange={onChange}
				onCreateEditor={(view) => {
					if (labelledBy) {
						view.contentDOM.setAttribute(
							'aria-labelledby',
							labelledBy,
						)
					}
				}}
				readOnly={disabled}
				theme={
					resolvedTheme === 'dark'
						? [oneDark, lightTheme, darkTheme]
						: lightTheme
				}
				value={value}
			/>
			<div
				aria-live="polite"
				className={cn(
					'border-t px-3 py-2 text-xs',
					validationError
						? 'text-destructive'
						: 'text-muted-foreground',
				)}
			>
				{validationError ?? 'Valid BedrockNexus workflow template'}
			</div>
		</fieldset>
	)
}
