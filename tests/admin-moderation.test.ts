// @vitest-environment node
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AdminModerationActions } from '@/components/admin-dashboard/admin-moderation-actions'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

describe.each(['server', 'project', 'plugin'] as const)(
	'%s shared moderation controls',
	(contentType) => {
		function render(
			status: 'draft' | 'under_review' | 'published',
			moderationStatus: 'approved' | 'pending' | 'flagged' = 'approved',
			wasPublished = false,
		) {
			return renderToStaticMarkup(
				createElement(AdminModerationActions, {
					contentId: 'example',
					contentName: 'Example',
					contentType,
					status,
					moderationStatus,
					wasPublished,
				}),
			).replace(/<[^>]*>/g, '')
		}
		it('offers flag and unpublish for public listings', () => {
			const text = render('published')
			expect(text).toContain('Flag')
			expect(text).toContain('Unpublish')
		})
		it('offers approval, feedback, and rejection for pending listings', () => {
			const text = render('under_review', 'pending')
			for (const label of ['Approve', 'Request changes', 'Reject']) {
				expect(text).toContain(label)
			}
		})
		it('offers submission decisions alongside listing controls for a public update', () => {
			const text = renderToStaticMarkup(
				createElement(AdminModerationActions, {
					contentId: 'example',
					contentName: 'Example',
					contentType,
					status: 'published',
					moderationStatus: 'approved',
					wasPublished: true,
					submissionStatus: 'pending',
					submissionRevision: 4,
				}),
			).replace(/<[^>]*>/g, '')
			for (const label of [
				'Approve',
				'Request changes',
				'Reject',
				'Flag',
				'Unpublish',
			]) {
				expect(text).toContain(label)
			}
			expect(text).not.toContain('Restore')
		})
		it('offers restoration after unpublishing', () => {
			expect(render('draft', 'approved', true)).toContain('Restore')
		})
		it('offers restoration and feedback for flagged listings', () => {
			const text = render('under_review', 'flagged', true)
			expect(text).toContain('Restore')
			expect(text).toContain('Request changes')
		})
	},
)
