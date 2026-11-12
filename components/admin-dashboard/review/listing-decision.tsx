'use client'

import { useMutation } from 'convex/react'
import type { ModerationStatus } from '@/components/admin-dashboard/admin-content-status'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { type DecisionOption, DecisionPanel } from './review-rail'

type ContentStatus = 'draft' | 'published' | 'under_review'
type Action = 'approve' | 'changes' | 'reject' | 'flag' | 'unpublish'
type ContentType = 'project' | 'server' | 'plugin'

export interface ListingState {
	contentType: ContentType
	status: ContentStatus
	moderationStatus?: ModerationStatus
	submissionStatus?: 'pending' | 'changes_requested' | 'approved' | 'rejected'
	/** The listing has been public before. */
	wasPublished: boolean
	canApprove: boolean
	approveDisabledReason?: string
}

function patchFor(action: Action, reason: string) {
	switch (action) {
		case 'approve':
			return {
				status: 'published' as const,
				moderationStatus: 'approved' as const,
			}
		case 'changes':
			return {
				status: 'draft' as const,
				moderationStatus: 'pending' as const,
				moderationReason: reason,
			}
		case 'flag':
			return {
				status: 'under_review' as const,
				moderationStatus: 'flagged' as const,
				moderationReason: reason,
			}
		case 'reject':
			return {
				status: 'under_review' as const,
				moderationStatus: 'rejected' as const,
				moderationReason: reason,
			}
		default:
			return {
				status: 'draft' as const,
				moderationStatus: 'approved' as const,
				moderationReason: reason,
			}
	}
}

function approveOption(
	state: ListingState,
	label: string,
	hint: string,
): DecisionOption {
	return {
		id: 'approve',
		label,
		hint,
		tone: 'approve',
		submit: label,
		message: 'none',
		unavailable: state.canApprove
			? undefined
			: (state.approveDisabledReason ??
				'This listing is not ready to approve.'),
		done: 'Approved. It is live now.',
	}
}

function reviewOptions(state: ListingState, pending: boolean) {
	const update = state.wasPublished && pending
	const restore = state.wasPublished && !pending
	const options: DecisionOption[] = []
	if (restore) {
		options.push(
			approveOption(state, 'Restore listing', 'It is public again now.'),
		)
	} else if (update) {
		options.push(
			approveOption(state, 'Approve changes', 'The changes go live now.'),
		)
	} else {
		options.push(
			approveOption(
				state,
				'Approve listing',
				'The listing goes public now.',
			),
		)
	}
	if (state.moderationStatus !== 'rejected') {
		options.push({
			id: 'changes',
			label: 'Request changes',
			hint: update
				? 'The creator fixes them and resubmits. The live listing stays as it is.'
				: 'The creator fixes them and resubmits.',
			tone: 'changes',
			submit: 'Send back to the creator',
			message: 'required',
			done: 'Sent back. The creator sees your message on their dashboard.',
		})
	}
	options.push({
		id: 'reject',
		label: update ? 'Reject changes' : 'Reject listing',
		hint: update
			? 'The changes are dropped. The live listing stays as it is.'
			: 'The listing stays hidden. The creator sees your message.',
		tone: 'reject',
		submit: update ? 'Reject changes' : 'Reject listing',
		message: 'required',
		done: 'Rejected. The creator sees your message.',
	})
	return options
}

function publishedOptions(state: ListingState) {
	const options: DecisionOption[] = []
	if (
		state.contentType === 'server' &&
		state.moderationStatus !== 'approved'
	) {
		options.push(
			approveOption(
				state,
				'Approve listing',
				'Marks the server as reviewed.',
			),
		)
	}
	options.push(
		{
			id: 'flag',
			label: 'Flag for review',
			hint: 'Takes it out of public listings until the creator fixes the issue.',
			tone: 'changes',
			submit: 'Flag listing',
			message: 'required',
			done: 'Flagged. It is out of public listings until it is fixed.',
		},
		{
			id: 'unpublish',
			label: 'Unpublish',
			hint: 'Returns it to draft and removes it from public listings.',
			tone: 'reject',
			submit: 'Unpublish listing',
			message: 'required',
			done: 'Unpublished. It is a draft again.',
		},
	)
	return options
}

/** What a moderator can do with a listing in its current state. */
export function listingOptions(state: ListingState) {
	const pending = state.submissionStatus === 'pending'
	if (state.status === 'under_review' || pending) {
		// A live listing can still be taken down while an update waits.
		const takeDown =
			state.status === 'published'
				? publishedOptions(state).filter(
						(option) => option.id !== 'approve',
					)
				: []
		return {
			title: 'Decision',
			options: [...reviewOptions(state, pending), ...takeDown],
		}
	}
	if (state.status === 'published') {
		return { title: 'Moderation actions', options: publishedOptions(state) }
	}
	const canPublish =
		state.contentType === 'server' ||
		state.wasPublished ||
		(state.contentType === 'plugin' && state.canApprove)
	if (state.status === 'draft' && canPublish) {
		return {
			title: 'Moderation actions',
			options: [
				approveOption(
					state,
					state.wasPublished ? 'Restore listing' : 'Publish listing',
					'It is public now.',
				),
			],
		}
	}
	return { title: 'Moderation actions', options: [] }
}

/** Approve, return, reject or take down one listing. */
export function ListingDecision({
	contentId,
	submissionRevision = 0,
	locked,
	...state
}: ListingState & {
	contentId: string
	submissionRevision?: number
	locked?: string
}) {
	const moderatePlugin = useMutation(
		api.functions.plugins.moderation.moderate,
	)
	const updateProject = useMutation(
		api.functions.projects.projects.adminUpdate,
	)
	const updateServer = useMutation(api.functions.servers.servers.updateAdmin)
	const requestProjectChanges = useMutation(
		api.functions.projects.projects.requestChanges,
	)
	const { title, options } = listingOptions(state)

	const submit = async (id: string, reason: string) => {
		const action = id as Action
		const expectedRevision = submissionRevision
		if (state.contentType === 'plugin') {
			await moderatePlugin({
				id: contentId as Id<'plugins'>,
				expectedRevision,
				action,
				reason: reason || undefined,
			})
		} else if (action === 'changes' && state.contentType === 'project') {
			await requestProjectChanges({
				id: contentId as Id<'projects'>,
				expectedRevision,
				reason,
			})
		} else if (state.contentType === 'server') {
			await updateServer({
				id: contentId as Id<'servers'>,
				expectedRevision,
				...patchFor(action, reason),
			})
		} else {
			await updateProject({
				id: contentId as Id<'projects'>,
				expectedRevision,
				...patchFor(action, reason),
			})
		}
	}

	return (
		<DecisionPanel
			currentId={contentId}
			key={contentId}
			locked={locked}
			onSubmit={submit}
			options={options}
			revision={submissionRevision}
			title={title}
		/>
	)
}

/** Approve or reject one release of an addon or resource pack. */
export function ReleaseDecision({
	versionId,
	version,
	canApprove,
	locked,
}: {
	versionId: Id<'projectVersions'>
	version: string
	canApprove: boolean
	locked?: string
}) {
	const reviewRelease = useMutation(
		api.functions.projects.versions.reviewRelease,
	)
	return (
		<DecisionPanel
			currentId={versionId}
			key={versionId}
			locked={locked}
			onSubmit={async (id, reason) => {
				await reviewRelease({
					versionId,
					decision: id === 'approve' ? 'approved' : 'rejected',
					reason: id === 'approve' ? undefined : reason,
				})
			}}
			options={[
				{
					id: 'approve',
					label: 'Approve version',
					hint: `Everyone can download ${version} now.`,
					tone: 'approve',
					submit: `Approve ${version}`,
					message: 'none',
					unavailable: canApprove
						? undefined
						: 'The file has not passed the automatic checks.',
					done: `${version} is approved and can be downloaded now.`,
				},
				{
					id: 'reject',
					label: 'Reject version',
					hint: 'The file stays hidden and the current version stays. The creator sees your message.',
					tone: 'reject',
					submit: `Reject ${version}`,
					message: 'required',
					done: `${version} is rejected. The creator sees your message.`,
				},
			]}
		/>
	)
}

/** Publish, return or reject one plugin release built from GitHub. */
export function PluginReleaseDecision({
	releaseId,
	version,
	submissionRevision = 0,
	publicationBlocked,
	locked,
}: {
	releaseId: Id<'pluginReleases'>
	version: string
	submissionRevision?: number
	publicationBlocked: boolean
	locked?: string
}) {
	const approve = useMutation(
		api.functions.plugins.publishing.model.approveReview,
	)
	const requestChanges = useMutation(
		api.functions.plugins.publishing.model.requestReviewChanges,
	)
	const reject = useMutation(
		api.functions.plugins.publishing.model.rejectReview,
	)
	return (
		<DecisionPanel
			currentId={releaseId}
			key={releaseId}
			locked={locked}
			onSubmit={async (id, reason) => {
				const expectedRevision = submissionRevision
				if (id === 'approve') {
					await approve({
						releaseId,
						expectedRevision,
						...(reason ? { note: reason } : {}),
					})
				} else if (id === 'changes') {
					await requestChanges({
						releaseId,
						reason,
						expectedRevision,
					})
				} else {
					await reject({ releaseId, reason, expectedRevision })
				}
			}}
			options={[
				{
					id: 'approve',
					label: 'Approve and publish',
					hint: `Version ${version} goes live in a moment.`,
					tone: 'approve',
					submit: `Publish ${version}`,
					message: 'optional',
					unavailable: publicationBlocked
						? 'Restore this listing before publishing a release.'
						: undefined,
					done: `Approved. Version ${version} goes live in a moment.`,
				},
				{
					id: 'changes',
					label: 'Request changes',
					hint: 'The creator fixes them and sends a new build.',
					tone: 'changes',
					submit: 'Send back to the creator',
					message: 'required',
					done: 'Sent back. The creator sees your message.',
				},
				{
					id: 'reject',
					label: 'Reject',
					hint: 'The build is not published. The creator sees your message.',
					tone: 'reject',
					submit: `Reject ${version}`,
					message: 'required',
					done: 'Rejected. The creator sees your message.',
				},
			]}
			title={`Version ${version}`}
		/>
	)
}
