import { describe, expect, it } from 'vitest'
import {
	type ListingState,
	listingOptions,
} from '@/components/admin-dashboard/review/listing-decision'

describe.each(['server', 'project', 'plugin'] as const)(
	'%s moderation decisions',
	(contentType) => {
		function labels(state: Partial<ListingState>) {
			return listingOptions({
				contentType,
				status: 'published',
				moderationStatus: 'approved',
				wasPublished: false,
				canApprove: true,
				...state,
			}).options.map((option) => option.label)
		}
		it('offers flag and unpublish for public listings', () => {
			expect(labels({})).toEqual(
				expect.arrayContaining(['Flag for review', 'Unpublish']),
			)
		})
		it('offers approval, feedback, and rejection for a new listing', () => {
			expect(
				labels({ status: 'under_review', moderationStatus: 'pending' }),
			).toEqual(['Approve listing', 'Request changes', 'Reject listing'])
		})
		it('reviews an update to a live listing, which can still be taken down', () => {
			expect(
				labels({ wasPublished: true, submissionStatus: 'pending' }),
			).toEqual([
				'Approve changes',
				'Request changes',
				'Reject changes',
				'Flag for review',
				'Unpublish',
			])
		})
		it('offers restoration after unpublishing', () => {
			expect(labels({ status: 'draft', wasPublished: true })).toContain(
				'Restore listing',
			)
		})
		it('offers restoration and feedback for flagged listings', () => {
			const options = labels({
				status: 'under_review',
				moderationStatus: 'flagged',
				wasPublished: true,
			})
			expect(options).toContain('Restore listing')
			expect(options).toContain('Request changes')
		})
		it('says why a listing cannot be approved yet', () => {
			const approve = listingOptions({
				contentType,
				status: 'under_review',
				moderationStatus: 'pending',
				wasPublished: false,
				canApprove: false,
				approveDisabledReason: 'A file is required.',
			}).options[0]
			expect(approve.unavailable).toBe('A file is required.')
		})
	},
)
