// @vitest-environment node
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
	type ComparedField,
	SubmissionComparison,
} from '@/components/admin-dashboard/submission-comparison'

vi.mock('@/components/editor/rich-text-viewer', () => ({
	RichTextViewer: ({ content }: { content: string }) =>
		createElement('div', null, content),
}))
function render(fields: ComparedField[], firstSubmission = false) {
	return renderToStaticMarkup(
		createElement(SubmissionComparison, {
			comparison: { fields, firstSubmission },
		}),
	)
}
describe('submission comparison presentation', () => {
	it('labels additions, removals, and changes with before and submitted values', () => {
		const text = render([
			{
				key: 'name',
				label: 'Name',
				kind: 'text',
				before: 'Old name',
				after: 'New name',
			},
			{
				key: 'website',
				label: 'Website',
				kind: 'text',
				before: null,
				after: 'https://example.com',
			},
			{
				key: 'license',
				label: 'License',
				kind: 'text',
				before: 'MIT',
				after: null,
			},
		])
		for (const value of [
			'Changed',
			'Added',
			'Removed',
			'Old name',
			'New name',
			'Last approved',
			'Submitted',
			'Not provided',
		]) {
			expect(text).toContain(value)
		}
	})
	it('keeps long descriptions expandable and escapes untrusted text', () => {
		const text = render([
			{
				key: 'description',
				label: 'Description',
				kind: 'description',
				before: 'Approved description',
				after: '<script>bad()</script>',
			},
		])
		expect(text).toContain('<details')
		expect(text).toContain('<summary')
		expect(text).toContain('&lt;script&gt;')
		expect(text).not.toContain('<script>bad()')
	})
	it('shows the absence of an earlier approval on first submissions', () => {
		expect(
			render(
				[
					{
						key: 'name',
						label: 'Name',
						kind: 'text',
						before: null,
						after: 'New creation',
					},
				],
				true,
			),
		).toContain('No approved listing yet')
	})
	it('renders release metadata as readable facts instead of raw JSON', () => {
		const text = render([
			{
				key: 'release',
				label: 'Release',
				kind: 'release',
				before: null,
				after: JSON.stringify({
					version: '1.1.0',
					fileName: 'plugin.jar',
					changelog: 'A new feature',
					gameVersions: ['1.21.0'],
				}),
			},
		])
		expect(text).toContain('File Name')
		expect(text).toContain('plugin.jar')
		expect(text).toContain('Changelog')
		expect(text).not.toContain('&quot;fileName&quot;')
	})
	it('handles a release submission with unchanged listing metadata', () => {
		expect(render([])).toContain('No listing details changed')
	})
})
