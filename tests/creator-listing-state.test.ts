import { describe, expect, it } from 'vitest'
import {
	type CreatorListingInput,
	creatorListingState,
	creatorSidebarStatus,
} from '../lib/creator-listing-state'

const live = { status: 'published', moderationStatus: 'approved' }
describe('creator moderation states across catalogs', () => {
	it('keeps published listings public while an update is reviewed', () => {
		for (const extra of [
			{ draftChangesJson: '{}' },
			{
				visibility: 'public',
				hasDraftChanges: true,
				releaseStage: 'inReview',
			},
		]) {
			expect(
				creatorListingState({
					...live,
					...extra,
					submissionStatus: 'pending',
				}),
			).toMatchObject({
				publication: 'published',
				published: true,
				review: 'pending',
				locked: true,
				canSubmit: false,
			})
		}
	})
	it('keeps returned and rejected updates separate from an approved listing', () => {
		for (const [submissionStatus, releaseStage] of [
			['changes_requested', 'changesRequested'],
			['rejected', 'rejected'],
		]) {
			expect(
				creatorListingState({
					...live,
					submissionStatus,
					draftChangesJson: '{}',
				}),
			).toMatchObject({
				publication: 'published',
				review: submissionStatus,
				canSubmit: true,
				locked: false,
			})
			expect(
				creatorListingState({
					...live,
					visibility: 'public',
					releaseStage,
				}),
			).toMatchObject({
				publication: 'published',
				review: submissionStatus,
				canSubmit: true,
				locked: false,
			})
		}
	})
	it('shows private edits without claiming a new submission exists', () => {
		expect(
			creatorListingState({
				...live,
				submissionStatus: 'approved',
				draftChangesJson: '{}',
			}),
		).toMatchObject({
			review: 'draft_changes',
			published: true,
			locked: false,
		})
		expect(
			creatorListingState({
				...live,
				visibility: 'public',
				releaseStage: 'published',
				hasDraftChanges: true,
			}),
		).toMatchObject({
			review: 'draft_changes',
			published: true,
			locked: false,
		})
	})
	it.each([
		[{ ...live, moderationStatus: 'flagged' }, 'flagged'],
		[{ ...live, status: 'draft', publishedAt: 1 }, 'unpublished'],
		[{ ...live, visibility: 'hidden' }, 'unpublished'],
		[{ ...live, visibility: 'suspended' }, 'unpublished'],
		[{ ...live, moderationStatus: 'pending' }, 'unpublished'],
		[{ ...live, status: 'archived' }, 'archived'],
	] as [CreatorListingInput, string][])(
		'never shows a public link or published count for restricted content %j',
		(input, expected) => {
			expect(creatorListingState(input)).toMatchObject({
				publication: expected,
				published: false,
			})
			expect(creatorSidebarStatus(input)).toBe(expected)
		},
	)
	it('handles rejected initial submissions without a false review lock', () => {
		const input = {
			status: 'under_review',
			moderationStatus: 'rejected',
			submissionReason: 'Wrong content',
			moderationReason: 'Older note',
		}
		expect(creatorListingState(input)).toMatchObject({
			publication: 'rejected',
			review: 'rejected',
			locked: false,
			canSubmit: false,
			reason: 'Wrong content',
		})
	})
	it('handles legacy initial reviews and plugin publication progress', () => {
		expect(
			creatorSidebarStatus({
				status: 'under_review',
				moderationStatus: 'pending',
			}),
		).toBe('in_review')
		for (const releaseStage of ['preparing', 'inReview', 'publishing']) {
			expect(
				creatorListingState({ status: 'draft', releaseStage }),
			).toMatchObject({ review: 'pending', locked: true })
		}
		expect(creatorListingState({ status: 'draft' })).toMatchObject({
			publication: 'draft',
			review: 'not_submitted',
			canSubmit: true,
		})
		expect(
			creatorListingState({ status: 'published', visibility: 'public' })
				.published,
		).toBe(true)
		expect(creatorListingState({ status: 'published' }).published).toBe(
			false,
		)
	})
})

it('uses the current listing decision over an older release stage', () => {
	expect(
		creatorListingState({
			...live,
			submissionStatus: 'approved',
			releaseStage: 'changesRequested',
		}),
	).toMatchObject({ review: 'approved' })
})

it('shows pending standalone versions without locking the listing editor', () => {
	expect(
		creatorListingState({
			...live,
			submissionStatus: 'approved',
			hasPendingVersions: true,
		}),
	).toMatchObject({
		review: 'pending',
		locked: false,
		canSubmit: true,
		published: true,
	})
})
