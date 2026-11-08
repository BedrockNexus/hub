'use client'

import { Cancel01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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

type ReviewStatus = 'pending' | 'approved' | 'rejected' | undefined

export function ReleaseReviewBadge({ status }: { status: ReviewStatus }) {
	if (status === 'pending') {
		return <Badge variant="outline">Awaiting review</Badge>
	}
	if (status === 'rejected') {
		return <Badge variant="destructive">Rejected</Badge>
	}
	return <Badge variant="secondary">Approved</Badge>
}

/** Approve or reject one release of a public project. */
export function ReleaseReviewActions({
	versionId,
	versionLabel,
	canApprove,
}: {
	versionId: Id<'projectVersions'>
	versionLabel: string
	canApprove: boolean
}) {
	const reviewRelease = useMutation(
		api.functions.projects.versions.reviewRelease,
	)
	const [isRejecting, setIsRejecting] = useState(false)
	const [reason, setReason] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	const submit = async (decision: 'approved' | 'rejected') => {
		setIsSubmitting(true)
		try {
			await reviewRelease({
				versionId,
				decision,
				reason: decision === 'rejected' ? reason.trim() : undefined,
			})
			toast.success(
				`${versionLabel} ${decision === 'approved' ? 'approved' : 'rejected'}`,
			)
			setIsRejecting(false)
			setReason('')
		} catch (error) {
			toast.error(userFacingError(error, 'Could not review the release'))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<>
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={isSubmitting || !canApprove}
					onClick={() => submit('approved')}
					size="sm"
					title={
						canApprove ? undefined : 'Validation has not passed yet'
					}
				>
					<HugeiconsIcon
						className="size-4"
						icon={CheckmarkCircle01Icon}
					/>
					Approve
				</Button>
				<Button
					disabled={isSubmitting}
					onClick={() => setIsRejecting(true)}
					size="sm"
					variant="destructive"
				>
					<HugeiconsIcon className="size-4" icon={Cancel01Icon} />
					Reject
				</Button>
			</div>

			<Dialog
				onOpenChange={(open) =>
					!(open || isSubmitting) && setIsRejecting(false)
				}
				open={isRejecting}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject {versionLabel}?</DialogTitle>
						<DialogDescription>
							The release stays private and cannot be resubmitted.
							The creator will see your reason.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor={`release-reason-${versionId}`}>
							Reason for creator
						</Label>
						<Textarea
							disabled={isSubmitting}
							id={`release-reason-${versionId}`}
							maxLength={500}
							onChange={(event) => setReason(event.target.value)}
							value={reason}
						/>
					</div>
					<DialogFooter>
						<Button
							disabled={isSubmitting}
							onClick={() => setIsRejecting(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={isSubmitting || !reason.trim()}
							onClick={() => submit('rejected')}
							variant="destructive"
						>
							{isSubmitting ? (
								<Spinner className="size-4" />
							) : null}
							Reject release
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
