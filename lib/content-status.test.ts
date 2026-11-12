import { describe, expect, it } from 'bun:test'
import { contentStatus } from './content-status'

const live = {
	lifecycle: 'published',
	moderation: 'approved',
	wasPublished: true,
} as const

describe('content status', () => {
	it('is live when public and approved', () => {
		expect(contentStatus(live)).toMatchObject({
			label: 'Live',
			needsReview: false,
		})
	})

	it('notes an update waiting on a live listing', () => {
		expect(
			contentStatus({ ...live, submission: 'pending', waitingSince: 5 }),
		).toMatchObject({
			key: 'live',
			note: 'Update in review',
			needsReview: true,
			waitingSince: 5,
		})
	})

	it('notes a version waiting on a live listing', () => {
		expect(
			contentStatus({ ...live, pendingVersion: '2.4.0' }),
		).toMatchObject({
			key: 'live',
			note: 'Version 2.4.0 in review',
			needsReview: true,
		})
	})

	it('notes an update that was sent back, without asking for review', () => {
		expect(
			contentStatus({ ...live, submission: 'changes_requested' }),
		).toMatchObject({
			key: 'live',
			note: 'Update sent back',
			needsReview: false,
		})
	})

	it('waits for review on a first submission', () => {
		expect(
			contentStatus({
				lifecycle: 'under_review',
				moderation: 'pending',
				submission: 'pending',
				wasPublished: false,
			}),
		).toMatchObject({ key: 'awaiting_review', needsReview: true })
	})

	it('puts flags and rejections before anything else', () => {
		expect(
			contentStatus({
				...live,
				moderation: 'flagged',
				submission: 'pending',
			}),
		).toMatchObject({ key: 'flagged' })
		expect(
			contentStatus({
				lifecycle: 'under_review',
				moderation: 'rejected',
				wasPublished: false,
			}),
		).toMatchObject({ key: 'rejected' })
	})

	it('tells drafts from listings that were taken down', () => {
		expect(
			contentStatus({ lifecycle: 'draft', wasPublished: false }),
		).toMatchObject({ key: 'draft' })
		expect(
			contentStatus({
				lifecycle: 'draft',
				moderation: 'approved',
				wasPublished: true,
			}),
		).toMatchObject({ key: 'unpublished' })
	})

	it('shows a first submission that was sent back', () => {
		expect(
			contentStatus({
				lifecycle: 'draft',
				moderation: 'pending',
				submission: 'changes_requested',
				wasPublished: false,
			}),
		).toMatchObject({ key: 'changes_requested' })
	})

	it('shows archived plugins as archived', () => {
		expect(
			contentStatus({ lifecycle: 'archived', wasPublished: true }),
		).toMatchObject({ key: 'archived' })
	})
})
