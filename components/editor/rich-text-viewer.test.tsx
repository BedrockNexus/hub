import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'

describe('RichTextViewer YouTube directives', () => {
	test('renders a responsive privacy-enhanced YouTube iframe', () => {
		const markup = renderToStaticMarkup(
			<RichTextViewer content={'::youtube{id="dQw4w9WgXcQ"}'} />,
		)

		expect(markup).toContain('bedrock-youtube-embed')
		expect(markup).toContain(
			'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"',
		)
		expect(markup).toContain('allowFullScreen')
	})

	test('does not render invalid YouTube directives', () => {
		const markup = renderToStaticMarkup(
			<RichTextViewer content={'::youtube{id="invalid"}'} />,
		)

		expect(markup).not.toContain('<iframe')
	})
})

describe('RichTextViewer imported READMEs', () => {
	const base = {
		images: 'https://raw.githubusercontent.com/owner/plugin/main/',
		links: 'https://github.com/owner/plugin/blob/main/',
	}

	test('drops raw HTML and unsafe links', () => {
		const markup = renderToStaticMarkup(
			<RichTextViewer
				content={
					"<script>alert('no')</script>\n\n**Safe** [docs](javascript:alert(1))"
				}
				relativeUrlBase={base}
				skipHtml
			/>,
		)

		expect(markup).not.toContain('<script')
		expect(markup).not.toContain('alert(')
		expect(markup).not.toContain('javascript:')
		expect(markup).toContain('>Safe</strong>')
	})

	test('points relative images and links into the repository', () => {
		const markup = renderToStaticMarkup(
			<RichTextViewer
				content={
					'![demo](./images/demo.png) [guide](docs/GUIDE.md) [site](https://example.com) [top](#install)'
				}
				relativeUrlBase={base}
			/>,
		)

		expect(markup).toContain(
			'src="https://raw.githubusercontent.com/owner/plugin/main/images/demo.png"',
		)
		expect(markup).toContain(
			'href="https://github.com/owner/plugin/blob/main/docs/GUIDE.md"',
		)
		expect(markup).toContain('href="https://example.com"')
		expect(markup).toContain('href="#install"')
	})
})
