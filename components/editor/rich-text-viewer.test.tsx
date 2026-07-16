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
