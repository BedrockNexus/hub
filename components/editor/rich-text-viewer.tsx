import type { Root } from 'mdast'
import type { LeafDirective } from 'mdast-util-directive'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { YoutubeEmbed } from '@/components/editor/youtube-embed'
import { cn } from '@/lib/utils'
import { getYoutubeVideoId } from '@/lib/youtube'

const remarkYoutubeDirective: Plugin<[], Root> = () => (tree) => {
	visit(tree, 'leafDirective', (node: LeafDirective, index, parent) => {
		if (node.name !== 'youtube') {
			return
		}

		const videoId = getYoutubeVideoId(node.attributes?.id ?? '')
		if (!videoId) {
			if (parent && typeof index === 'number') {
				parent.children.splice(index, 1)
			}
			return
		}

		node.data = {
			...node.data,
			hName: 'div',
			hProperties: {
				'data-youtube-id': videoId,
			},
		}
	})
}

const markdownComponents: Components = {
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
	div: ({ children, ...props }) => {
		const youtubeId = (props as Record<string, unknown>)['data-youtube-id']
		if (typeof youtubeId === 'string') {
			return (
				<YoutubeEmbed
					className="bedrock-youtube-embed my-6"
					videoId={youtubeId}
				/>
			)
		}

		return <div {...props}>{children}</div>
	},
	em: ({ className, ...props }) => (
		<em className={cn('italic', className)} {...props} />
	),
	h1: ({ className, ...props }) => (
		<h1
			className={cn(
				'mt-8 mb-4 scroll-m-20 font-bold text-4xl tracking-tight first:mt-0',
				className,
			)}
			{...props}
		/>
	),
	h2: ({ className, ...props }) => (
		<h2
			className={cn(
				'mt-8 mb-3 scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0',
				className,
			)}
			{...props}
		/>
	),
	h3: ({ className, ...props }) => (
		<h3
			className={cn(
				'mt-6 mb-3 scroll-m-20 font-semibold text-2xl tracking-tight first:mt-0',
				className,
			)}
			{...props}
		/>
	),
	h4: ({ className, ...props }) => (
		<h4
			className={cn(
				'mt-5 mb-2 scroll-m-20 font-semibold text-xl tracking-tight first:mt-0',
				className,
			)}
			{...props}
		/>
	),
	hr: ({ className, ...props }) => (
		<hr className={cn('my-6 border-border', className)} {...props} />
	),
	img: ({ alt, className, ...props }) => (
		// biome-ignore lint/performance/noImgElement: Markdown images can have unknown remote dimensions
		// biome-ignore lint/correctness/useImageSize: Markdown images can have unknown remote dimensions
		<img
			alt={alt ?? ''}
			className={cn('my-4 max-w-full rounded-md border', className)}
			{...props}
		/>
	),
	input: ({ className, ...props }) => (
		<input
			className={cn('mr-2 size-4 align-[-0.125em]', className)}
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
			className={cn('my-4 ml-6 list-disc space-y-1', className)}
			{...props}
		/>
	),
}

interface RichTextViewerProps {
	content?: string | null
	className?: string
}

export function RichTextViewer({ content, className }: RichTextViewerProps) {
	if (!content?.trim()) {
		return null
	}

	return (
		<div className={cn('max-w-none text-base text-foreground', className)}>
			<ReactMarkdown
				components={markdownComponents}
				remarkPlugins={[
					remarkGfm,
					remarkDirective,
					remarkYoutubeDirective,
				]}
			>
				{content}
			</ReactMarkdown>
		</div>
	)
}
