'use client'

import { Download01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'
import { toast } from 'sonner'
import { PluginReviewStatusBadge } from '@/components/admin-dashboard/plugin-review-status'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import { formatBytes, formatRegistryDate } from '@/lib/plugins/format-registry'

type Review = NonNullable<
	FunctionReturnType<typeof api.functions.plugins.projects.getAdminReview>
>
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
	return error instanceof Error ? error.message : 'The review action failed.'
}

export function AdminPluginReleaseReview({
	release,
	submissionRevision,
	repositoryUrl,
	relativeUrlBase,
	publicationBlocked = false,
}: {
	release: Review['releases'][number]
	submissionRevision?: number
	repositoryUrl?: string
	relativeUrlBase?: { images: string; links: string }
	publicationBlocked?: boolean
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
	const retry = useMutation(
		api.functions.plugins.publishing.model.retryPublishing,
	)
	const getDownload = useAction(
		api.functions.plugins.publishing.actions.getReviewDownloadUrl,
	)
	const [note, setNote] = useState('')
	const [busy, setBusy] = useState(false)
	const publicationDisabled = busy || publicationBlocked
	async function attempt(operation: () => Promise<void>) {
		setBusy(true)
		try {
			await operation()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setBusy(false)
		}
	}
	async function decide(decision: Decision) {
		const reason = note.trim()
		if (decision !== 'approve' && !reason) {
			toast.error('Add a reason before requesting changes or rejecting.')
			return
		}
		await attempt(async () => {
			const releaseId = release._id
			const expectedRevision = submissionRevision ?? 0
			if (decision === 'approve') {
				await approve({
					releaseId,
					expectedRevision,
					...(reason ? { note: reason } : {}),
				})
				toast.success('Approved. The version goes live in a moment.')
			} else if (decision === 'changes') {
				await requestChanges({ releaseId, reason, expectedRevision })
				toast.success('Changes requested.')
			} else {
				await reject({ releaseId, reason, expectedRevision })
				toast.success('Submission rejected.')
			}
			setNote('')
		})
	}
	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Version {release.version}</CardTitle>
						<p className="mt-1 text-muted-foreground text-sm">
							Submitted {formatRegistryDate(release.submittedAt)}
						</p>
					</div>
					<PluginReviewStatusBadge status={release.status} />
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				{publicationBlocked &&
				['inReview', 'publishing'].includes(release.status) ? (
					<p className="text-muted-foreground text-sm">
						Restore this listing before publishing a release.
					</p>
				) : null}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
					<div className="min-w-0 text-sm">
						<p className="break-all font-medium">
							{release.fileName ?? 'File not available yet'}
						</p>
						{release.size === undefined ? null : (
							<p className="text-muted-foreground">
								{formatBytes(release.size)}
							</p>
						)}
					</div>
					{release.uploadKey ? (
						<Button
							disabled={busy}
							onClick={() =>
								attempt(async () => {
									window.location.assign(
										await getDownload({
											releaseId: release._id,
										}),
									)
								})
							}
							variant="outline"
						>
							<HugeiconsIcon aria-hidden icon={Download01Icon} />
							Download submitted file
						</Button>
					) : null}
				</div>
				{repositoryUrl ? (
					<p className="text-sm">
						Commit{' '}
						<a
							className="font-mono hover:underline"
							href={`${repositoryUrl}/commit/${release.commitSha}`}
							rel="noreferrer"
							target="_blank"
						>
							{release.commitSha.slice(0, 7)}
						</a>
						{release.branch ? ` on ${release.branch}` : ''}
						{release.logsUrl ? (
							<>
								{' '}
								-{' '}
								<a
									className="hover:underline"
									href={release.logsUrl}
									rel="noreferrer"
									target="_blank"
								>
									Build logs
								</a>
							</>
						) : null}
					</p>
				) : null}
				{release.sha256 ? (
					<p className="break-all font-mono text-muted-foreground text-xs">
						SHA-256 {release.sha256}
					</p>
				) : null}
				<section className="space-y-3">
					<h3 className="font-semibold text-sm">Changelog</h3>
					<RichTextViewer
						content={release.changelog}
						relativeUrlBase={relativeUrlBase}
					/>
				</section>
				{release.reviewNotes ? (
					<div className="space-y-1 border-t pt-4">
						<h3 className="font-semibold text-sm">Review note</h3>
						<p className="whitespace-pre-wrap text-muted-foreground text-sm">
							{release.reviewNotes}
						</p>
					</div>
				) : null}
				{release.failureReason ? (
					<p className="rounded-md border border-destructive/40 p-3 text-sm">
						{release.failureReason}
					</p>
				) : null}
				{release.status === 'publishing' ? (
					<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
						<p>
							{release.failureReason
								? 'Publishing needs attention.'
								: 'Publishing the approved file...'}
						</p>
						{release.failureReason ? (
							<Button
								disabled={publicationDisabled}
								onClick={() =>
									attempt(async () => {
										await retry({
											releaseId: release._id,
											expectedRevision:
												submissionRevision ?? 0,
										})
										toast.success('Retrying publication.')
									})
								}
							>
								Retry publishing
							</Button>
						) : null}
					</div>
				) : null}
				{release.status === 'inReview' ? (
					<div className="space-y-3 border-t pt-4">
						<Textarea
							aria-label={`Review note for version ${release.version}`}
							disabled={busy}
							maxLength={500}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Optional approval note, or the reason for changes or rejection"
							value={note}
						/>
						<div className="flex flex-wrap justify-end gap-2">
							<Button
								disabled={busy}
								onClick={() => decide('reject')}
								variant="destructive"
							>
								Reject
							</Button>
							<Button
								disabled={busy}
								onClick={() => decide('changes')}
								variant="outline"
							>
								Request changes
							</Button>
							<Button
								disabled={publicationDisabled}
								onClick={() => decide('approve')}
							>
								Approve and publish
							</Button>
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
