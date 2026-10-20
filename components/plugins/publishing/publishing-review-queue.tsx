'use client'

import {
	Cancel01Icon,
	CheckmarkCircle02Icon,
	Download01Icon,
	GitBranchIcon,
	Package01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useMutation, useQuery } from 'convex/react'
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
import { formatBytes, formatRegistryDate } from '@/lib/plugins/format-registry'

type Decision = 'approve' | 'changes' | 'reject'

function errorMessage(error: unknown) {
	if (
		typeof error === 'object' &&
		error !== null &&
		'data' in error &&
		typeof error.data === 'object' &&
		error.data !== null &&
		'message' in error.data &&
		typeof error.data.message === 'string'
	) {
		return error.data.message
	}
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
	const retryPublishing = useMutation(
		api.functions.plugins.publishing.model.retryPublishing,
	)
	const getDownloadUrl = useAction(
		api.functions.plugins.publishing.actions.getReviewDownloadUrl,
	)
	const [notes, setNotes] = useState<Record<string, string>>({})
	const [busy, setBusy] = useState<string | null>(null)

	async function attempt(key: string, operation: () => Promise<void>) {
		setBusy(key)
		try {
			await operation()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusy(null)
		}
	}

	async function decide(releaseId: Id<'pluginReleases'>, decision: Decision) {
		const key = releaseId as string
		const note = notes[key]?.trim() ?? ''
		if (decision !== 'approve' && !note) {
			toast.error('Add a reason before requesting changes or rejecting.')
			return
		}
		await attempt(`${key}:${decision}`, async () => {
			if (decision === 'approve') {
				await approve({ releaseId, ...(note ? { note } : {}) })
				toast.success('Approved. The version goes live in a moment.')
			} else if (decision === 'changes') {
				await requestChanges({ releaseId, reason: note })
				toast.success('Changes were requested from the developer.')
			} else {
				await reject({ releaseId, reason: note })
				toast.success('The version was rejected.')
			}
		})
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
						Builds developers send to review appear here.
					</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-5">
			{reviews.map((review) => {
				const key = review.releaseId as string
				const publishing = review.status === 'publishing'
				return (
					<Card className="shadow-none" key={key}>
						<CardHeader>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<CardTitle>
										{review.projectName} {review.version}
									</CardTitle>
									<CardDescription className="mt-1">
										{review.softwareName} · sent{' '}
										{formatRegistryDate(review.submittedAt)}
										{review.firstRelease
											? ' · first version'
											: ''}
									</CardDescription>
								</div>
								<Badge
									variant={publishing ? 'default' : 'outline'}
								>
									{publishing
										? 'Publishing'
										: 'Awaiting review'}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										Repository
									</p>
									<a
										className="mt-1 flex items-center gap-1.5 font-medium hover:text-primary"
										href={review.repository.htmlUrl}
										rel="noreferrer"
										target="_blank"
									>
										<HugeiconsIcon
											className="size-4"
											icon={GitBranchIcon}
										/>
										{review.repository.fullName}
									</a>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										Build
									</p>
									<p className="mt-1 font-medium">
										<a
											className="font-mono hover:text-primary"
											href={`${review.repository.htmlUrl}/commit/${review.commitSha}`}
											rel="noreferrer"
											target="_blank"
										>
											{review.commitSha.slice(0, 7)}
										</a>
										{review.branch
											? ` on ${review.branch}`
											: ''}
										{review.logsUrl ? (
											<>
												{' · '}
												<a
													className="text-primary hover:underline"
													href={review.logsUrl}
													rel="noreferrer"
													target="_blank"
												>
													logs
												</a>
											</>
										) : null}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										File
									</p>
									<div className="mt-1 flex items-center justify-between gap-2">
										<p className="flex min-w-0 items-center gap-1.5 font-medium">
											<HugeiconsIcon
												className="size-4 shrink-0"
												icon={Package01Icon}
											/>
											<span className="truncate">
												{review.fileName}
												{review.size
													? ` · ${formatBytes(review.size)}`
													: ''}
											</span>
										</p>
										{publishing ? null : (
											<Button
												disabled={busy !== null}
												onClick={() =>
													attempt(
														`${key}:download`,
														async () => {
															window.location.assign(
																await getDownloadUrl(
																	{
																		releaseId:
																			review.releaseId,
																	},
																),
															)
														},
													)
												}
												size="sm"
												variant="outline"
											>
												<HugeiconsIcon
													className="size-4"
													icon={Download01Icon}
												/>
												Download
											</Button>
										)}
									</div>
								</div>
							</div>

							{review.sha256 ? (
								<p className="break-all font-mono text-muted-foreground text-xs">
									SHA-256 {review.sha256}
								</p>
							) : null}

							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<p className="font-medium text-sm">
										Changelog
									</p>
									<p className="mt-1 whitespace-pre-wrap text-muted-foreground text-sm leading-6">
										{review.changelog}
									</p>
								</div>
								<div>
									<p className="font-medium text-sm">
										Summary
									</p>
									<p className="mt-1 text-muted-foreground text-sm leading-6">
										{review.summary}
									</p>
								</div>
							</div>

							{publishing ? (
								<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted p-3 text-sm">
									<span>
										{review.failureReason ??
											'Copying the file to the CDN…'}
									</span>
									{review.failureReason ? (
										<Button
											disabled={busy !== null}
											onClick={() =>
												attempt(
													`${key}:retry`,
													async () => {
														await retryPublishing({
															releaseId:
																review.releaseId,
														})
														toast.success(
															'Trying again.',
														)
													},
												)
											}
											size="sm"
										>
											Retry
										</Button>
									) : null}
								</div>
							) : (
								<>
									<Textarea
										aria-label={`Review note for ${review.projectName} ${review.version}`}
										className="min-h-24"
										onChange={(event) =>
											setNotes((current) => ({
												...current,
												[key]: event.target.value,
											}))
										}
										placeholder="Optional approval note, or the reason for changes or rejection"
										value={notes[key] ?? ''}
									/>
									<div className="flex flex-wrap justify-end gap-2">
										<Button
											disabled={busy !== null}
											onClick={() =>
												void decide(
													review.releaseId,
													'reject',
												)
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
												void decide(
													review.releaseId,
													'changes',
												)
											}
											variant="outline"
										>
											Request changes
										</Button>
										<Button
											disabled={busy !== null}
											onClick={() =>
												void decide(
													review.releaseId,
													'approve',
												)
											}
										>
											<HugeiconsIcon
												className="size-4"
												icon={CheckmarkCircle02Icon}
											/>
											Approve and publish
										</Button>
									</div>
								</>
							)}
						</CardContent>
					</Card>
				)
			})}
		</div>
	)
}
