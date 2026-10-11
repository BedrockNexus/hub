'use client'

import {
	Cancel01Icon,
	CheckmarkCircle02Icon,
	GitBranchIcon,
	Package01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { formatRegistryDate } from '@/lib/plugins/format-registry'

type Decision = 'approve' | 'changes' | 'reject'

function errorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: 'The review decision failed.'
}

export function PublishingReviewQueue() {
	const reviews = useQuery(
		api.functions.plugins.publishing.model.listReviewQueue,
		{},
	)
	const approve = useMutation(
		api.functions.plugins.publishing.model.approveReview,
	)
	const requestChanges = useMutation(
		api.functions.plugins.publishing.model.requestReviewChanges,
	)
	const reject = useMutation(
		api.functions.plugins.publishing.model.rejectReview,
	)
	const [notes, setNotes] = useState<Record<string, string>>({})
	const [busy, setBusy] = useState<string | null>(null)

	async function decide(
		draftId: Id<'pluginPublishingDrafts'>,
		decision: Decision,
	) {
		const key = draftId as string
		const note = notes[key]?.trim() ?? ''
		if (decision !== 'approve' && !note) {
			toast.error(
				'Add a reason before requesting changes or rejecting a release.',
			)
			return
		}
		setBusy(`${key}:${decision}`)
		try {
			if (decision === 'approve') {
				await approve({ draftId, ...(note ? { note } : {}) })
				toast.success('The verified release is now published.')
			} else if (decision === 'changes') {
				await requestChanges({ draftId, reason: note })
				toast.success('Changes were requested from the publisher.')
			} else {
				await reject({ draftId, reason: note })
				toast.success('The release submission was rejected.')
			}
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusy(null)
		}
	}

	if (reviews === undefined) {
		return (
			<p className="text-muted-foreground text-sm">
				Loading publishing reviews…
			</p>
		)
	}

	if (reviews.length === 0) {
		return (
			<Card className="border-dashed shadow-none">
				<CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
					<span className="grid size-14 place-items-center rounded-md bg-primary text-primary-foreground">
						<HugeiconsIcon
							className="size-6"
							icon={CheckmarkCircle02Icon}
						/>
					</span>
					<h2 className="mt-5 font-semibold text-lg">
						Review queue is clear
					</h2>
					<p className="mt-2 max-w-md text-muted-foreground text-sm">
						Verified project releases submitted by publishers will
						appear here.
					</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-5">
			{reviews.map(({ draft, repository, projectName }) => {
				const key = draft._id as string
				return (
					<Card className="shadow-none" key={key}>
						<CardHeader>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<CardTitle>{projectName}</CardTitle>
									<CardDescription className="mt-1">
										Submitted{' '}
										{draft.submittedAt
											? formatRegistryDate(
													draft.submittedAt,
												)
											: 'for review'}
									</CardDescription>
								</div>
								<Badge variant="outline">Awaiting review</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										Repository
									</p>
									<a
										className="mt-1 flex items-center gap-1.5 font-medium hover:text-primary"
										href={repository.htmlUrl}
										rel="noreferrer"
										target="_blank"
									>
										<HugeiconsIcon
											className="size-4"
											icon={GitBranchIcon}
										/>
										{repository.fullName}
									</a>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										Adapter
									</p>
									<p className="mt-1 font-medium">
										{draft.adapterId}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										Release
									</p>
									{draft.latestReleaseUrl ? (
										<a
											className="mt-1 block font-medium hover:text-primary"
											href={draft.latestReleaseUrl}
											rel="noreferrer"
											target="_blank"
										>
											{draft.latestTag}
										</a>
									) : (
										<p className="mt-1 font-medium">
											{draft.latestTag}
										</p>
									)}
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										Primary asset
									</p>
									<p className="mt-1 flex items-center gap-1.5 font-medium">
										<HugeiconsIcon
											className="size-4"
											icon={Package01Icon}
										/>
										{draft.primaryAssetName}
									</p>
								</div>
							</div>

							<div>
								<p className="font-medium text-sm">
									Metadata summary
								</p>
								<p className="mt-1 text-muted-foreground text-sm leading-6">
									{draft.summary}
								</p>
							</div>

							<Textarea
								aria-label={`Review note for ${projectName}`}
								className="min-h-24"
								onChange={(event) =>
									setNotes((current) => ({
										...current,
										[key]: event.target.value,
									}))
								}
								placeholder="Optional approval note, or required reason for changes/rejection"
								value={notes[key] ?? ''}
							/>

							<div className="flex flex-wrap justify-end gap-2">
								<Button
									disabled={busy !== null}
									onClick={() =>
										void decide(draft._id, 'reject')
									}
									variant="destructive"
								>
									<HugeiconsIcon
										className="size-4"
										icon={Cancel01Icon}
									/>
									Reject
								</Button>
								<Button
									disabled={busy !== null}
									onClick={() =>
										void decide(draft._id, 'changes')
									}
									variant="outline"
								>
									Request changes
								</Button>
								<Button
									disabled={busy !== null}
									onClick={() =>
										void decide(draft._id, 'approve')
									}
								>
									<HugeiconsIcon
										className="size-4"
										icon={CheckmarkCircle02Icon}
									/>
									Approve and publish
								</Button>
							</div>
						</CardContent>
					</Card>
				)
			})}
		</div>
	)
}
