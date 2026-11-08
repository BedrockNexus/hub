'use client'
import { useMutation, useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { userFacingError } from '@/lib/user-facing-error'
export type ReviewContentId =
	| Id<'projects'>
	| Id<'plugins'>
	| Id<'servers'>
	| Id<'projectVersions'>
export function ReviewAssignment({
	contentId,
	revision,
	pending,
	children,
}: {
	contentId: ReviewContentId
	revision: number
	pending: boolean
	children: ReactNode
}) {
	const assignment = useQuery(api.functions.moderation.work.assignment, {
		contentId,
		revision,
	})
	const claim = useMutation(api.functions.moderation.work.claim)
	const other = !!assignment?.assignee && !assignment.mine
	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
				<p className="text-muted-foreground text-xs">Reviewer</p>
				<p className="text-sm">
					{assignment
						? (assignment.assignee ?? 'Unassigned')
						: 'Loading assignment...'}
				</p>
				{pending ? (
					<Button
						disabled={!assignment || other}
						onClick={async () => {
							try {
								await claim({
									contentId,
									revision,
									release: assignment?.mine,
								})
								toast.success(
									assignment?.mine
										? 'Review released'
										: 'Review assigned to you',
								)
							} catch (error) {
								toast.error(
									userFacingError(
										error,
										'Could not update assignment',
									),
								)
							}
						}}
						size="sm"
						variant="outline"
					>
						{assignment?.mine ? 'Release review' : 'Claim review'}
					</Button>
				) : null}
				{other ? (
					<p className="text-muted-foreground text-xs">
						This submission is assigned to another moderator.
					</p>
				) : null}
			</div>
			<fieldset
				className="min-w-0 shrink-0 space-y-4"
				disabled={other || (pending && !assignment)}
			>
				<legend className="sr-only">Moderation decisions</legend>
				{children}
			</fieldset>
		</div>
	)
}
