'use client'

import {
	Cancel01Icon,
	CheckmarkCircle01Icon,
	Flag01Icon,
	ViewOffSlashIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ModerationStatus } from '@/components/admin-dashboard/admin-content-status'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { userFacingError } from '@/lib/user-facing-error'

type ContentStatus = 'draft' | 'published' | 'under_review'
type ModerationAction = 'approve' | 'flag' | 'reject' | 'unpublish' | 'changes'

const ACTION_COPY: Record<
	ModerationAction,
	{ title: string; description: string; submit: string }
> = {
	changes: {
		title: 'Request changes?',
		description:
			'Return this submission with feedback so the creator can correct it and submit again. Existing approved content stays public.',
		submit: 'Request changes',
	},
	approve: {
		title: 'Approve content?',
		description:
			'This marks the content as reviewed and ensures it is visible on the public website.',
		submit: 'Approve',
	},
	flag: {
		title: 'Flag for review?',
		description:
			'This removes the content from public listings until the creator resolves the issue.',
		submit: 'Flag for Review',
	},
	reject: {
		title: 'Reject submission?',
		description:
			'Reject this submission with feedback. An existing approved listing stays public; a rejected first submission stays hidden.',
		submit: 'Reject',
	},
	unpublish: {
		title: 'Unpublish content?',
		description:
			'This returns the content to draft and removes it from public listings.',
		submit: 'Unpublish',
	},
}

function getModerationPatch(action: ModerationAction, reason: string) {
	if (action === 'approve') {
		return {
			status: 'published' as const,
			moderationStatus: 'approved' as const,
		}
	}

	if (action === 'changes') {
		return {
			status: 'draft' as const,
			moderationStatus: 'pending' as const,
			moderationReason: reason,
		}
	}

	if (action === 'flag') {
		return {
			status: 'under_review' as const,
			moderationStatus: 'flagged' as const,
			moderationReason: reason,
		}
	}

	if (action === 'reject') {
		return {
			status: 'under_review' as const,
			moderationStatus: 'rejected' as const,
			moderationReason: reason,
		}
	}

	return {
		status: 'draft' as const,
		moderationStatus: 'approved' as const,
		moderationReason: reason,
	}
}

function needsModerationReason(action: ModerationAction | null) {
	return (
		action !== null &&
		['flag', 'reject', 'changes', 'unpublish'].includes(action)
	)
}

function ModerationButtons({
	status,
	contentType,
	moderationStatus,
	wasPublished,
	hasPendingSubmission,
	canApprove,
	approveDisabledReason,
	onApprove,
	onAction,
}: {
	status: ContentStatus
	contentType: 'project' | 'server' | 'plugin'
	moderationStatus?: ModerationStatus
	wasPublished: boolean
	hasPendingSubmission: boolean
	canApprove: boolean
	approveDisabledReason?: string
	onApprove: () => void
	onAction: (action: ModerationAction) => void
}) {
	const isPublishedServerAwaitingReview =
		contentType === 'server' &&
		status === 'published' &&
		moderationStatus !== 'approved'
	return (
		<div className="flex flex-wrap gap-2">
			{status === 'under_review' || hasPendingSubmission ? (
				<>
					<Button
						disabled={!canApprove}
						onClick={onApprove}
						title={approveDisabledReason}
					>
						<HugeiconsIcon
							className="size-4"
							icon={CheckmarkCircle01Icon}
						/>
						{wasPublished && !hasPendingSubmission
							? 'Restore'
							: 'Approve'}
					</Button>
					{moderationStatus === 'rejected' ? null : (
						<Button
							onClick={() => onAction('changes')}
							variant="outline"
						>
							Request changes
						</Button>
					)}
					<Button
						onClick={() => onAction('reject')}
						variant="destructive"
					>
						<HugeiconsIcon className="size-4" icon={Cancel01Icon} />
						Reject
					</Button>
				</>
			) : null}
			{status === 'draft' &&
			!hasPendingSubmission &&
			(contentType === 'server' ||
				wasPublished ||
				(contentType === 'plugin' && canApprove)) ? (
				<Button
					disabled={!canApprove}
					onClick={onApprove}
					title={approveDisabledReason}
				>
					<HugeiconsIcon
						className="size-4"
						icon={CheckmarkCircle01Icon}
					/>
					{wasPublished ? 'Restore' : 'Publish'}
				</Button>
			) : null}
			{status === 'published' ? (
				<>
					{isPublishedServerAwaitingReview ? (
						<Button onClick={onApprove}>
							<HugeiconsIcon
								className="size-4"
								icon={CheckmarkCircle01Icon}
							/>
							Approve
						</Button>
					) : null}
					<Button onClick={() => onAction('flag')} variant="outline">
						<HugeiconsIcon className="size-4" icon={Flag01Icon} />
						Flag
					</Button>
					<Button
						onClick={() => onAction('unpublish')}
						variant="destructive"
					>
						<HugeiconsIcon
							className="size-4"
							icon={ViewOffSlashIcon}
						/>
						Unpublish
					</Button>
				</>
			) : null}
		</div>
	)
}

export function AdminModerationActions({
	approveDisabledReason,
	canApprove = true,
	contentId,
	contentName,
	contentType,
	moderationStatus,
	status,
	wasPublished = false,
	submissionStatus,
	submissionRevision = 0,
}: {
	approveDisabledReason?: string
	canApprove?: boolean
	contentId: string
	contentName: string
	contentType: 'project' | 'server' | 'plugin'
	moderationStatus?: ModerationStatus
	status: ContentStatus
	wasPublished?: boolean
	submissionStatus?: 'pending' | 'changes_requested' | 'approved' | 'rejected'
	submissionRevision?: number
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
	const [action, setAction] = useState<ModerationAction | null>(null)
	const [reason, setReason] = useState('')
	const [dialogRevision, setDialogRevision] = useState(submissionRevision)
	const openAction = (next: ModerationAction) => {
		setDialogRevision(submissionRevision)
		setAction(next)
	}
	const [isSubmitting, setIsSubmitting] = useState(false)

	const openApproveDialog = () => {
		if (!canApprove) {
			toast.error(
				approveDisabledReason ?? 'This content is not ready to approve',
			)
			return
		}
		openAction('approve')
	}

	const close = () => {
		if (!isSubmitting) {
			setAction(null)
			setReason('')
		}
	}

	const submit = async () => {
		if (!action) {
			return
		}
		const trimmedReason = reason.trim()
		if (needsModerationReason(action) && !trimmedReason) {
			toast.error('Add a reason for the creator')
			return
		}

		const patch = getModerationPatch(action, trimmedReason)

		setIsSubmitting(true)
		try {
			if (contentType === 'plugin') {
				await moderatePlugin({
					id: contentId as Id<'plugins'>,
					expectedRevision: dialogRevision,
					action,
					reason: trimmedReason || undefined,
				})
			} else if (action === 'changes' && contentType === 'project') {
				await requestProjectChanges({
					id: contentId as Id<'projects'>,
					expectedRevision: dialogRevision,
					reason: trimmedReason,
				})
			} else if (contentType === 'server') {
				await updateServer({
					id: contentId as Id<'servers'>,
					expectedRevision: dialogRevision,
					...patch,
				})
			} else {
				await updateProject({
					id: contentId as Id<'projects'>,
					expectedRevision: dialogRevision,
					...patch,
				})
			}
			toast.success(`${contentName} updated`)
			setAction(null)
			setReason('')
		} catch (error) {
			toast.error(
				userFacingError(error, 'Could not update moderation status'),
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<>
			<ModerationButtons
				approveDisabledReason={approveDisabledReason}
				canApprove={canApprove}
				contentType={contentType}
				hasPendingSubmission={submissionStatus === 'pending'}
				moderationStatus={moderationStatus}
				onAction={openAction}
				onApprove={openApproveDialog}
				status={status}
				wasPublished={wasPublished}
			/>

			<Dialog onOpenChange={(open) => !open && close()} open={!!action}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{action ? ACTION_COPY[action].title : ''}
						</DialogTitle>
						<DialogDescription>
							{action ? ACTION_COPY[action].description : ''}
						</DialogDescription>
					</DialogHeader>
					{needsModerationReason(action) ? (
						<div className="space-y-2">
							<Label htmlFor="moderation-reason">
								Reason for creator
							</Label>
							<Textarea
								disabled={isSubmitting}
								id="moderation-reason"
								maxLength={500}
								onChange={(event) =>
									setReason(event.target.value)
								}
								placeholder="Describe what needs to be changed."
								value={reason}
							/>
							<p className="text-right text-muted-foreground text-xs">
								{reason.length}/500
							</p>
						</div>
					) : null}
					<DialogFooter>
						<Button
							disabled={isSubmitting}
							onClick={close}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={isSubmitting}
							onClick={submit}
							variant={
								action === 'reject' || action === 'unpublish'
									? 'destructive'
									: 'default'
							}
						>
							{isSubmitting ? (
								<Spinner className="size-4" />
							) : null}
							{action ? ACTION_COPY[action].submit : 'Confirm'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
