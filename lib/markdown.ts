import type { Element, Root as HastRoot } from 'hast'
import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import diff from 'highlight.js/lib/languages/diff'
import groovy from 'highlight.js/lib/languages/groovy'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import properties from 'highlight.js/lib/languages/properties'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import type { Root } from 'mdast'
import type { LeafDirective } from 'mdast-util-directive'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive'
import remarkGemoji from 'remark-gemoji'
import remarkGfm from 'remark-gfm'
import type { PluggableList, Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { getYoutubeVideoId } from '@/lib/youtube'

/**
 * The Markdown pipeline behind RichTextViewer, matching what GitHub renders
 * for a README: GFM, sanitized inline HTML (GitHub's own allow-list), alerts,
 * heading anchors, emoji shortcodes and highlighted code.
 */

export const ALERT_TYPES = [
	'note',
	'tip',
	'important',
	'warning',
	'caution',
] as const
export type AlertType = (typeof ALERT_TYPES)[number]

// GitHub only treats the marker as an alert when it is alone on the first line.
const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\n|$)/i

/** `> [!NOTE]` blockquotes become alert boxes, as on GitHub. */
const remarkGithubAlerts: Plugin<[], Root> = () => (tree) => {
	visit(tree, 'blockquote', (node) => {
		const paragraph = node.children[0]
		const text =
			paragraph?.type === 'paragraph' ? paragraph.children[0] : undefined
		if (paragraph?.type !== 'paragraph' || text?.type !== 'text') {
			return
		}
		const match = ALERT_MARKER.exec(text.value)
		if (!match) {
			return
		}
		text.value = text.value.slice(match[0].length)
		if (!text.value) {
			paragraph.children.shift()
		}
		if (paragraph.children.length === 0) {
			node.children.shift()
		}
		node.data = {
			...node.data,
			hName: 'div',
			hProperties: { dataAlert: match[1]?.toLowerCase() },
		}
	})
}

/** `::youtube{id=…}` embeds a video. */
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
			hProperties: { dataYoutubeId: videoId },
		}
	})
}

// GitHub's allow-list, plus the attributes our own Markdown extensions add.
const sanitizeSchema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		div: [
			...(defaultSchema.attributes?.div ?? []),
			'dataAlert',
			'dataYoutubeId',
		],
	},
}

const CLOBBER_PREFIX = defaultSchema.clobberPrefix ?? 'user-content-'

/**
 * The sanitizer prefixes ids (footnotes, `<a name>`) so they cannot clobber
 * page globals; point `#name` links at the prefixed id, as GitHub does.
 */
const rehypeInPageLinks: Plugin<[], HastRoot> = () => (tree) => {
	const ids = new Set<string>()
	visit(tree, 'element', (node: Element) => {
		for (const key of ['id', 'name'] as const) {
			const value = node.properties[key]
			if (typeof value === 'string') {
				ids.add(value)
			}
		}
	})
	visit(tree, 'element', (node: Element) => {
		const href = node.properties.href
		if (node.tagName !== 'a' || typeof href !== 'string') {
			return
		}
		const target = href.startsWith('#') ? href.slice(1) : null
		if (target && !ids.has(target) && ids.has(CLOBBER_PREFIX + target)) {
			node.properties.href = `#${CLOBBER_PREFIX}${target}`
		}
	})
}

/** The sanitizer adds the id prefix itself; adding it here too doubles it. */
export const remarkRehypeOptions = { clobberPrefix: '' }

const HIGHLIGHT_LANGUAGES = {
	bash,
	cpp,
	csharp,
	diff,
	groovy,
	ini,
	java,
	javascript,
	json,
	kotlin,
	markdown,
	php,
	plaintext,
	properties,
	python,
	rust,
	shell,
	sql,
	typescript,
	xml,
	yaml,
}

export const remarkPlugins: PluggableList = [
	remarkGfm,
	remarkGemoji,
	remarkGithubAlerts,
	remarkDirective,
	remarkYoutubeDirective,
]

export const rehypePlugins: PluggableList = [
	rehypeRaw,
	[rehypeSanitize, sanitizeSchema],
	// After sanitizing, so heading ids are ours and `#installation` links work.
	rehypeSlug,
	rehypeInPageLinks,
	[
		rehypeHighlight,
		{
			languages: HIGHLIGHT_LANGUAGES,
			aliases: { groovy: ['gradle'], ini: ['toml'] },
			detect: false,
		},
	],
]
