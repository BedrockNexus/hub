/**
 * Some older listings were saved as HTML by a previous editor. The viewer only
 * renders Markdown (raw HTML is never rendered), so convert the common tags to
 * Markdown and drop everything else as text.
 */

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	'#39': "'",
	apos: "'",
	nbsp: ' ',
}

const LEGACY_HTML_START = /^\s*<(p|h[1-6]|ul|ol|div|blockquote)[\s>]/i

export function looksLikeLegacyHtml(content: string): boolean {
	return LEGACY_HTML_START.test(content)
}

function decodeEntities(text: string) {
	return text.replace(/&(#?\w+);/g, (match, name: string) => {
		if (name in ENTITIES) {
			return ENTITIES[name]
		}
		if (name.startsWith('#')) {
			const code =
				name[1] === 'x'
					? Number.parseInt(name.slice(2), 16)
					: Number(name.slice(1))
			return Number.isFinite(code) ? String.fromCodePoint(code) : match
		}
		return match
	})
}

export function legacyHtmlToMarkdown(html: string): string {
	const markdown = html
		.replace(
			/<h([1-6])[^>]*>/gi,
			(_, level: string) => `\n\n${'#'.repeat(Number(level))} `,
		)
		.replace(/<\/h[1-6]>/gi, '\n\n')
		.replace(/<li[^>]*>\s*(<p[^>]*>)?/gi, '\n- ')
		.replace(/<\/p>\s*<\/li>|<\/li>/gi, '')
		.replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '  \n')
		.replace(/<(strong|b)[^>]*>/gi, '**')
		.replace(/<\/(strong|b)>/gi, '**')
		.replace(/<(em|i)[^>]*>/gi, '_')
		.replace(/<\/(em|i)>/gi, '_')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
	return decodeEntities(markdown)
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}
