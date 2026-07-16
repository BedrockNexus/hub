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

type ContentStatus = 'draft' | 'published' | 'under_review'
type ModerationAction = 'approve' | 'flag' | 'reject' | 'unpublish'

const ACTION_COPY: Record<
	ModerationAction,
	{ title: string; description: string; submit: string }
> = {
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
			'The content returns to draft and the creator will see your reason.',
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

	if (action === 'flag') {
		return {
			status: 'under_review' as const,
			moderationStatus: 'flagged' as const,
			moderationReason: reason,
		}
	}

	if (action === 'reject') {
		return {
			status: 'draft' as const,
			moderationStatus: 'rejected' as const,
			moderationReason: reason,
		}
	}

	return {
		status: 'draft' as const,
		moderationStatus: 'approved' as const,
	}
}

export function AdminModerationActions({
	approveDisabledReason,
	canApprove = true,
	contentId,
	contentName,
	contentType,
	moderationStatus,
	status,
}: {
	approveDisabledReason?: string
	canApprove?: boolean
	contentId: string
	contentName: string
	contentType: 'project' | 'server'
	moderationStatus?: ModerationStatus
	status: ContentStatus
}) {
	const updateProject = useMutation(
		api.functions.projects.projects.adminUpdate,
	)
	const updateServer = useMutation(api.functions.servers.servers.updateAdmin)
	const [action, setAction] = useState<ModerationAction | null>(null)
	const [reason, setReason] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isPublishedServerAwaitingReview =
		contentType === 'server' &&
		status === 'published' &&
		moderationStatus !== 'approved'

	const openApproveDialog = () => {
		if (!canApprove) {
			toast.error(
				approveDisabledReason ?? 'This content is not ready to approve',
			)
			return
		}
		setAction('approve')
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
		if ((action === 'flag' || action === 'reject') && !trimmedReason) {
			toast.error('Add a reason for the creator')
			return
		}

		const patch = getModerationPatch(action, trimmedReason)

		setIsSubmitting(true)
		try {
			if (contentType === 'server') {
				await updateServer({
					id: contentId as Id<'servers'>,
					...patch,
				})
			} else {
				await updateProject({
					id: contentId as Id<'projects'>,
					...patch,
				})
			}
			toast.success(`${contentName} updated`)
			close()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not update moderation status',
			)
		} finally {
			setIsSubmitting(false)
			setAction(null)
			setReason('')
		}
	}

	return (
		<>
			<div className="flex flex-wrap gap-2">
				{status === 'under_review' ? (
					<>
						<Button
							disabled={!canApprove}
							onClick={openApproveDialog}
							title={approveDisabledReason}
						>
							<HugeiconsIcon
								className="size-4"
								icon={CheckmarkCircle01Icon}
							/>
							Approve
						</Button>
						<Button
							onClick={() => setAction('reject')}
							variant="destructive"
						>
							<HugeiconsIcon
								className="size-4"
								icon={Cancel01Icon}
							/>
							Reject
						</Button>
					</>
				) : null}
				{status === 'draft' && contentType === 'server' ? (
					<Button onClick={openApproveDialog}>
						<HugeiconsIcon
							className="size-4"
							icon={CheckmarkCircle01Icon}
						/>
						Publish
					</Button>
				) : null}
				{status === 'published' ? (
					<>
						{isPublishedServerAwaitingReview ? (
							<Button onClick={openApproveDialog}>
								<HugeiconsIcon
									className="size-4"
									icon={CheckmarkCircle01Icon}
								/>
								Approve
							</Button>
						) : null}
						<Button
							onClick={() => setAction('flag')}
							variant="outline"
						>
							<HugeiconsIcon
								className="size-4"
								icon={Flag01Icon}
							/>
							Flag
						</Button>
						<Button
							onClick={() => setAction('unpublish')}
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
					{action === 'flag' || action === 'reject' ? (
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
