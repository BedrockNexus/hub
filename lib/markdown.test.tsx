import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import {
	rehypePlugins,
	remarkPlugins,
	remarkRehypeOptions,
} from '@/lib/markdown'

const FOOTNOTE_REF = /href="#([^"]+)"[^>]*data-footnote-ref/
const FOOTNOTE_BACKREF = /href="#([^"]+)"[^>]*data-footnote-backref/

function render(markdown: string) {
	return renderToStaticMarkup(
		<ReactMarkdown
			rehypePlugins={rehypePlugins}
			remarkPlugins={remarkPlugins}
			remarkRehypeOptions={remarkRehypeOptions}
		>
			{markdown}
		</ReactMarkdown>,
	)
}

describe('GitHub-style Markdown', () => {
	test('keeps the inline HTML GitHub allows', () => {
		const html = render(
			'<p align="center"><img src="logo.png" width="96"></p>\n\n<details><summary>More</summary>\n\nHidden <kbd>Ctrl</kbd>\n\n</details>',
		)
		expect(html).toContain(
			'<p align="center"><img src="logo.png" width="96"/></p>',
		)
		expect(html).toContain('<details><summary>More</summary>')
		expect(html).toContain('<kbd>Ctrl</kbd>')
	})

	test('strips scripts, event handlers and javascript: links', () => {
		const html = render(
			'<script>alert(1)</script><img src="x.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
		)
		expect(html).not.toContain('<script')
		expect(html).not.toContain('onerror')
		expect(html).not.toContain('javascript:')
	})

	test('turns alert blockquotes into alerts', () => {
		const html = render('> [!WARNING]\n> Back up your world first.')
		expect(html).toContain('data-alert="warning"')
		expect(html).toContain('Back up your world first.')
		expect(html).not.toContain('[!WARNING]')
		expect(render('> [!WARNING] inline')).toContain('<blockquote>')
	})

	test('gives headings ids that in-page links can use', () => {
		const html = render('## Getting started\n\n[Jump](#getting-started)')
		expect(html).toContain('<h2 id="getting-started">')
		expect(html).toContain('href="#getting-started"')
	})

	test('links footnotes to their definitions', () => {
		const html = render('Text[^1]\n\n[^1]: The note.')
		const href = FOOTNOTE_REF.exec(html)?.[1]
		expect(href).toBeTruthy()
		expect(html).toContain(`id="${href}"`)
		const back = FOOTNOTE_BACKREF.exec(html)?.[1]
		expect(html).toContain(`id="${back}"`)
	})

	test('keeps YouTube embeds through the sanitizer', () => {
		expect(render('::youtube{id=dQw4w9WgXcQ}')).toContain(
			'data-youtube-id="dQw4w9WgXcQ"',
		)
	})

	test('replaces emoji shortcodes', () => {
		expect(render('Released :tada:')).toContain('Released 🎉')
	})

	test('highlights fenced code by language', () => {
		const html = render('```java\npublic class Main {}\n```')
		expect(html).toContain('hljs language-java')
		expect(html).toContain('<span class="hljs-keyword">public</span>')
	})
})
