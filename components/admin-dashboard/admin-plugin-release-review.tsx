'use client'

import { Download01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'
import { toast } from 'sonner'
import { PluginReviewStatusBadge } from '@/components/admin-dashboard/plugin-review-status'
import type { ReviewVersionRow } from '@/components/admin-dashboard/review-versions-table'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { userFacingError } from '@/lib/user-facing-error'

type Review = NonNullable<
	FunctionReturnType<typeof api.functions.plugins.projects.getAdminReview>
>
type Release = Review['releases'][number]

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
	return userFacingError(error, 'The review action failed.')
}

function reviewActionDisabled(
	busy: boolean,
	assignment: { assignee?: string; mine: boolean } | undefined,
) {
	return (
		busy || !assignment || Boolean(assignment.assignee && !assignment.mine)
	)
}

function releaseFacts(release: Release, repositoryUrl?: string) {
	const facts: NonNullable<ReviewVersionRow['facts']> = []
	if (repositoryUrl) {
		facts.push([
			'Commit',
			<span key="commit">
				<a
					className="font-mono hover:underline"
					href={`${repositoryUrl}/commit/${release.commitSha}`}
					rel="noreferrer"
					target="_blank"
				>
					{release.commitSha.slice(0, 7)}
				</a>
				{release.branch ? ` on ${release.branch}` : ''}
			</span>,
		])
	}
	if (release.logsUrl) {
		facts.push([
			'Build',
			<a
				className="hover:underline"
				href={release.logsUrl}
				key="logs"
				rel="noreferrer"
				target="_blank"
			>
				Build logs
			</a>,
		])
	}
	if (release.sha256) {
		facts.push([
			'SHA-256',
			<span className="font-mono text-xs" key="sha">
				{release.sha256}
			</span>,
		])
	}
	return facts
}

function releaseNotices(release: Release, publicationBlocked: boolean) {
	const blocked =
		publicationBlocked &&
		['inReview', 'publishing'].includes(release.status)
	if (!(blocked || release.reviewNotes || release.failureReason)) {
		return null
	}
	return (
		<div className="space-y-3 text-sm">
			{blocked ? (
				<p className="text-muted-foreground">
					Restore this listing before publishing a release.
				</p>
			) : null}
			{release.reviewNotes ? (
				<div className="space-y-1">
					<p className="font-medium">Review note</p>
					<p className="whitespace-pre-wrap text-muted-foreground">
						{release.reviewNotes}
					</p>
				</div>
			) : null}
			{release.failureReason ? (
				<p className="rounded-md border border-destructive/40 p-3">
					{release.failureReason}
				</p>
			) : null}
		</div>
	)
}

/** One plugin release as a row of the shared versions table. */
export function pluginReleaseRow(
	release: Release,
	{
		submissionRevision,
		repositoryUrl,
		relativeUrlBase,
		publicationBlocked,
	}: {
		submissionRevision?: number
		repositoryUrl?: string
		relativeUrlBase?: { images: string; links: string }
		publicationBlocked: boolean
	},
): ReviewVersionRow {
	return {
		id: release._id,
		version: release.version,
		fileName: release.fileName,
		size: release.size,
		submittedAt: release.submittedAt,
		status: <PluginReviewStatusBadge status={release.status} />,
		facts: releaseFacts(release, repositoryUrl),
		notices: releaseNotices(release, publicationBlocked),
		changelog: (
			<RichTextViewer
				content={release.changelog}
				relativeUrlBase={relativeUrlBase}
			/>
		),
		actions:
			release.uploadKey ||
			['inReview', 'publishing'].includes(release.status) ? (
				<AdminPluginReleaseActions
					publicationBlocked={publicationBlocked}
					release={release}
					submissionRevision={submissionRevision}
				/>
			) : undefined,
	}
}

/** Download, retry and review decisions for one plugin release. */
function AdminPluginReleaseActions({
	release,
	submissionRevision = 0,
	publicationBlocked,
}: {
	release: Release
	submissionRevision?: number
	publicationBlocked: boolean
}) {
	const retry = useMutation(
		api.functions.plugins.publishing.model.retryPublishing,
	)
	const getDownload = useAction(
		api.functions.plugins.publishing.actions.getReviewDownloadUrl,
	)
	const [busy, setBusy] = useState(false)
	const assignment = useQuery(api.functions.moderation.work.assignment, {
		contentId: release.projectId,
		revision: submissionRevision,
	})
	const reviewDisabled = reviewActionDisabled(busy, assignment)
	const publicationDisabled = reviewDisabled || publicationBlocked
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
	const download = release.uploadKey ? (
		<Button
			disabled={busy}
			onClick={() =>
				attempt(async () => {
					window.location.assign(
						await getDownload({ releaseId: release._id }),
					)
				})
			}
			variant="outline"
		>
			<HugeiconsIcon aria-hidden icon={Download01Icon} />
			Download submitted file
		</Button>
	) : null
	if (release.status === 'publishing') {
		return (
			<div className="flex flex-wrap items-center justify-between gap-3 text-sm">
				<p>
					{release.failureReason
						? 'Publishing needs attention.'
						: 'Publishing the approved file...'}
				</p>
				<div className="flex flex-wrap gap-2">
					{download}
					{release.failureReason ? (
						<Button
							disabled={publicationDisabled}
							onClick={() =>
								attempt(async () => {
									await retry({
										releaseId: release._id,
										expectedRevision: submissionRevision,
									})
									toast.success('Retrying publication.')
								})
							}
						>
							Retry publishing
						</Button>
					) : null}
				</div>
			</div>
		)
	}
	if (release.status === 'inReview') {
		return (
			<div className="flex flex-wrap items-center justify-between gap-3 text-sm">
				<p className="text-muted-foreground">
					Decide on this version in the panel on the right.
				</p>
				{download}
			</div>
		)
	}
	return download
}
