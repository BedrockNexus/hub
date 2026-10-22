import {
	Alert02Icon,
	AlertDiamondIcon,
	Idea01Icon,
	InformationCircleIcon,
	MessageNotification01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ComponentProps, ComponentType, ReactNode } from 'react'
import ReactMarkdown, {
	type Components,
	defaultUrlTransform,
	type UrlTransform,
} from 'react-markdown'
import { YoutubeEmbed } from '@/components/editor/youtube-embed'
import {
	ALERT_TYPES,
	type AlertType,
	rehypePlugins,
	remarkPlugins,
	remarkRehypeOptions,
} from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { getYoutubeVideoId } from '@/lib/youtube'

const ALERTS: Record<
	AlertType,
	{ label: string; icon: typeof Alert02Icon; className: string }
> = {
	note: {
		label: 'Note',
		icon: InformationCircleIcon,
		className:
			'border-sky-500 [&>p:first-child]:text-sky-600 dark:[&>p:first-child]:text-sky-400',
	},
	tip: {
		label: 'Tip',
		icon: Idea01Icon,
		className:
			'border-emerald-500 [&>p:first-child]:text-emerald-600 dark:[&>p:first-child]:text-emerald-400',
	},
	important: {
		label: 'Important',
		icon: MessageNotification01Icon,
		className:
			'border-violet-500 [&>p:first-child]:text-violet-600 dark:[&>p:first-child]:text-violet-400',
	},
	warning: {
		label: 'Warning',
		icon: Alert02Icon,
		className:
			'border-amber-500 [&>p:first-child]:text-amber-600 dark:[&>p:first-child]:text-amber-400',
	},
	caution: {
		label: 'Caution',
		icon: AlertDiamondIcon,
		className:
			'border-red-500 [&>p:first-child]:text-red-600 dark:[&>p:first-child]:text-red-400',
	},
}

function isAlertType(value: unknown): value is AlertType {
	return ALERT_TYPES.includes(value as AlertType)
}

function MarkdownAlert({
	type,
	children,
}: {
	type: AlertType
	children: ReactNode
}) {
	const alert = ALERTS[type]
	return (
		<div className={cn('my-4 border-l-4 py-1 pl-4', alert.className)}>
			<p className="mb-2 flex items-center gap-2 font-semibold">
				<HugeiconsIcon
					aria-hidden
					className="size-4"
					icon={alert.icon}
				/>
				{alert.label}
			</p>
			{children}
		</div>
	)
}

/** A heading with a hover link to itself, like GitHub's. */
function heading(
	Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
	classes: string,
) {
	return function Heading({
		className,
		id,
		children,
		...props
	}: ComponentProps<typeof Tag>) {
		return (
			<Tag
				className={cn('group scroll-m-20', classes, className)}
				id={id}
				{...props}
			>
				{children}
				{id ? (
					<a
						aria-label="Link to this section"
						className="ml-2 font-normal text-muted-foreground no-underline opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
						href={`#${id}`}
					>
						#
					</a>
				) : null}
			</Tag>
		)
	}
}

const styledComponents: Components = {
	a: ({ className, href, ...props }) => {
		const isExternal = href?.startsWith('http')

		return (
			<a
				className={cn(
					'font-medium text-primary underline underline-offset-4 hover:text-primary/80',
					className,
				)}
				href={href}
				rel={isExternal ? 'noopener noreferrer' : undefined}
				target={isExternal ? '_blank' : undefined}
				{...props}
			/>
		)
	},
	blockquote: ({ className, ...props }) => (
		<blockquote
			className={cn(
				'my-4 border-primary/70 border-l-4 pl-4 text-muted-foreground italic',
				className,
			)}
			{...props}
		/>
	),
	code: ({ className, ...props }) => (
		<code
			className={cn(
				'rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-sm',
				className,
			)}
			{...props}
		/>
	),
	del: ({ className, ...props }) => (
		<del className={cn('text-muted-foreground', className)} {...props} />
	),
	details: ({ className, ...props }) => (
		<details
			className={cn('my-4 rounded-md border px-4 py-2', className)}
			{...props}
		/>
	),
	div: ({ children, ...props }) => {
		const data = props as Record<string, unknown>
		// Raw HTML can carry these too, so the id is checked again here.
		const youtubeId = getYoutubeVideoId(
			String(data['data-youtube-id'] ?? ''),
		)
		if (youtubeId) {
			return (
				<YoutubeEmbed
					className="bedrock-youtube-embed my-6"
					videoId={youtubeId}
				/>
			)
		}
		const alert = data['data-alert']
		if (isAlertType(alert)) {
			return <MarkdownAlert type={alert}>{children}</MarkdownAlert>
		}

		return <div {...props}>{children}</div>
	},
	em: ({ className, ...props }) => (
		<em className={cn('italic', className)} {...props} />
	),
	h1: heading('h1', 'mt-8 mb-4 font-bold text-4xl tracking-tight first:mt-0'),
	h2: heading(
		'h2',
		'mt-8 mb-3 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0',
	),
	h3: heading(
		'h3',
		'mt-6 mb-3 font-semibold text-2xl tracking-tight first:mt-0',
	),
	h4: heading(
		'h4',
		'mt-5 mb-2 font-semibold text-xl tracking-tight first:mt-0',
	),
	h5: heading('h5', 'mt-4 mb-2 font-semibold text-lg first:mt-0'),
	h6: heading(
		'h6',
		'mt-4 mb-2 font-semibold text-base text-muted-foreground first:mt-0',
	),
	hr: ({ className, ...props }) => (
		<hr className={cn('my-6 border-border', className)} {...props} />
	),
	img: ({ alt, className, ...props }) => (
		// biome-ignore lint/performance/noImgElement: Markdown images can have unknown remote dimensions
		// biome-ignore lint/correctness/useImageSize: Markdown images can have unknown remote dimensions
		<img
			alt={alt ?? ''}
			className={cn('inline max-w-full', className)}
			{...props}
		/>
	),
	input: ({ className, ...props }) => (
		<input
			className={cn('mr-2 size-4 align-[-0.125em]', className)}
			{...props}
		/>
	),
	kbd: ({ className, ...props }) => (
		<kbd
			className={cn(
				'rounded-sm border border-b-2 bg-muted px-1.5 py-0.5 font-mono text-xs',
				className,
			)}
			{...props}
		/>
	),
	li: ({ className, ...props }) => (
		<li className={cn('pl-1 leading-7', className)} {...props} />
	),
	ol: ({ className, ...props }) => (
		<ol
			className={cn('my-4 ml-6 list-decimal space-y-1', className)}
			{...props}
		/>
	),
	p: ({ className, ...props }) => (
		<p className={cn('mb-4 leading-7 last:mb-0', className)} {...props} />
	),
	pre: ({ className, ...props }) => (
		<pre
			className={cn(
				'my-4 overflow-x-auto rounded-md border bg-muted p-4 text-sm [&_code]:bg-transparent [&_code]:p-0',
				className,
			)}
			{...props}
		/>
	),
	summary: ({ className, ...props }) => (
		<summary
			className={cn('cursor-pointer font-semibold', className)}
			{...props}
		/>
	),
	strong: ({ className, ...props }) => (
		<strong className={cn('font-semibold', className)} {...props} />
	),
	table: ({ className, ...props }) => (
		<div className="my-4 w-full overflow-x-auto">
			<table
				className={cn('w-full border-collapse text-sm', className)}
				{...props}
			/>
		</div>
	),
	td: ({ className, ...props }) => (
		<td
			className={cn('border px-3 py-2 align-top', className)}
			{...props}
		/>
	),
	th: ({ className, ...props }) => (
		<th
			className={cn(
				'border bg-muted px-3 py-2 text-left font-semibold',
				className,
			)}
			{...props}
		/>
	),
	ul: ({ className, ...props }) => (
		<ul
			className={cn(
				'my-4 ml-6 list-disc space-y-1',
				// Task lists show their checkboxes instead of bullets.
				className?.includes('contains-task-list') && 'ml-1 list-none',
				className,
			)}
			{...props}
		/>
	),
}

// react-markdown passes each component its hast `node`; spread onto a DOM
// element it would render as node="[object Object]".
const markdownComponents = Object.fromEntries(
	Object.entries(styledComponents).map(([tag, Component]) => {
		const Styled = Component as ComponentType<Record<string, unknown>>
		return [
			tag,
			({ node: _node, ...props }: Record<string, unknown>) => (
				<Styled {...props} />
			),
		]
	}),
) as Components

/**
 * Where relative URLs in the content point, e.g. a GitHub README's
 * `images/demo.png`: images resolve against `images`, links against `links`.
 */
export interface RelativeUrlBase {
	images: string
	links: string
}

// Absolute URLs (any scheme), in-page anchors, and protocol-relative URLs.
const NOT_RELATIVE_URL = /^([a-z][a-z\d+.-]*:|#|\/\/)/i
const LEADING_DOT_SLASH = /^\.?\//

function resolveRelativeUrls(base: RelativeUrlBase): UrlTransform {
	return (url, key) => {
		if (NOT_RELATIVE_URL.test(url)) {
			return defaultUrlTransform(url)
		}
		try {
			return defaultUrlTransform(
				new URL(
					url.replace(LEADING_DOT_SLASH, ''),
					key === 'src' ? base.images : base.links,
				).toString(),
			)
		} catch {
			return defaultUrlTransform(url)
		}
	}
}

interface RichTextViewerProps {
	content?: string | null
	className?: string
	relativeUrlBase?: RelativeUrlBase
}

export function RichTextViewer({
	content,
	className,
	relativeUrlBase,
}: RichTextViewerProps) {
	if (!content?.trim()) {
		return null
	}

	return (
		<div className={cn('max-w-none text-base text-foreground', className)}>
			<ReactMarkdown
				components={markdownComponents}
				rehypePlugins={rehypePlugins}
				remarkPlugins={remarkPlugins}
				remarkRehypeOptions={remarkRehypeOptions}
				urlTransform={
					relativeUrlBase
						? resolveRelativeUrls(relativeUrlBase)
						: defaultUrlTransform
				}
			>
				{content}
			</ReactMarkdown>
		</div>
	)
}
