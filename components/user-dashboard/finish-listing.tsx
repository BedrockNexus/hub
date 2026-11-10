'use client'

import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	ChangesPanel,
	ChecklistPanel,
	type PanelVariant,
} from '@/components/user-dashboard/checklist-panel'
import { usePluginForEdit } from '@/components/user-dashboard/plugins/edit/plugin-edit-data'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useMinute } from '@/hooks/use-minute'
import { contentEditHref } from '@/lib/content-routes'
import { creatorListingState } from '@/lib/creator-listing-state'
import { createPluginDashboardId } from '@/lib/plugins/plugin-dashboard-id'
import { pluginSubmissionChecklist } from '@/lib/plugins/plugin-submission'
import { projectSubmissionChecklist } from '@/lib/project-submission'
import { serverReference } from '@/lib/server-routes'
import { serverSubmissionChecklist } from '@/lib/server-submission'
import { userFacingError } from '@/lib/user-facing-error'
import { cn } from '@/lib/utils'

/**
 * The checklist and Submit button beside every settings page of a listing
 * (see ListingEditFrame). A draft gets "Finish your listing"; a published
 * listing with saved changes gets a short "Unsubmitted changes" card; in
 * review, after a rejection, or with nothing to send, nothing is shown.
 */

function SubmitActions({
	variant,
	label,
	ready,
	onSubmit,
	previewHref,
}: {
	variant: PanelVariant
	label: string
	ready: boolean
	onSubmit: () => Promise<void>
	previewHref?: string
}) {
	const [submitting, setSubmitting] = useState(false)
	const submit = async () => {
		setSubmitting(true)
		try {
			await onSubmit()
		} finally {
			setSubmitting(false)
		}
	}
	const preview = previewHref ? (
		<Link
			className="inline-flex min-h-9 items-center font-medium text-primary text-sm hover:underline"
			href={previewHref}
		>
			Preview listing
		</Link>
	) : null
	const button = (
		<Button
			className={cn(variant === 'rail' && 'w-full')}
			disabled={!ready || submitting}
			onClick={submit}
			type="button"
		>
			{submitting ? 'Submitting...' : label}
		</Button>
	)
	return variant === 'rail' ? (
		<>
			{button}
			{preview ? <div className="text-center">{preview}</div> : null}
		</>
	) : (
		<>
			{preview ?? <span />}
			{button}
		</>
	)
}

export function ProjectChecklist({
	id,
	variant,
}: {
	id: Id<'projects'>
	variant: PanelVariant
}) {
	const project = useQuery(api.functions.projects.projects.getForEdit, { id })
	const gallery = useQuery(
		api.functions.projects.gallery.listMine,
		project ? { projectId: id } : 'skip',
	)
	const update = useMutation(api.functions.projects.projects.update)
	if (!project || gallery === undefined) {
		return null
	}
	const state = creatorListingState(project)
	const hasSomethingToSend =
		project.status === 'draft' || state.hasDraftChanges
	if (!state.canSubmit || state.locked || !hasSomethingToSend) {
		return null
	}
	const base = contentEditHref(project.type, id, project.publicId)
	const checks = projectSubmissionChecklist({
		...project,
		hasGallery: gallery.length > 0,
	})
	const ready = checks.every((check) => !check.required || check.complete)
	const submit = async () => {
		try {
			await update({ id, status: 'under_review' })
			toast.success(`${project.name} submitted for review`)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not submit for review'))
		}
	}

	if (state.published) {
		return (
			<ChangesPanel
				actions={
					<SubmitActions
						label="Submit updates"
						onSubmit={submit}
						previewHref={`${base}/review`}
						ready={ready}
						variant={variant}
					/>
				}
				message="Your listing stays public. Saved changes stay private until a moderator approves them."
				variant={variant}
			/>
		)
	}
	return (
		<ChecklistPanel
			actions={
				<SubmitActions
					label={
						state.review === 'changes_requested'
							? 'Resubmit for review'
							: 'Submit for review'
					}
					onSubmit={submit}
					previewHref={`${base}/review`}
					ready={ready}
					variant={variant}
				/>
			}
			basePath={base}
			checks={checks}
			variant={variant}
		/>
	)
}

export function ServerChecklist({
	id,
	variant,
}: {
	id: string
	variant: PanelVariant
}) {
	const server = useQuery(api.functions.servers.servers.getForEdit, { id })
	const gallery = useQuery(
		api.functions.servers.gallery.listMine,
		server ? { serverId: server._id } : 'skip',
	)
	const updateServer = useMutation(api.functions.servers.servers.update)
	if (!server || gallery === undefined) {
		return null
	}
	const state = creatorListingState(server)
	const hasSomethingToSend =
		server.status === 'draft' ||
		(server.status === 'published' && !!server.draftChangesJson)
	if (!state.canSubmit || state.locked || !hasSomethingToSend) {
		return null
	}
	const checks = serverSubmissionChecklist(server, {
		hasGallery: gallery.length > 0,
	})
	const ready = checks.every((check) => !check.required || check.complete)
	const submit = async () => {
		try {
			await updateServer({ id: server._id, status: 'published' })
			toast.success(`${server.name} submitted for review`)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not submit for review'))
		}
	}

	if (server.status === 'published') {
		return (
			<ChangesPanel
				actions={
					<SubmitActions
						label="Submit updates"
						onSubmit={submit}
						ready={ready}
						variant={variant}
					/>
				}
				message="Your server stays listed. Saved changes stay private until a moderator approves them."
				variant={variant}
			/>
		)
	}
	return (
		<ChecklistPanel
			actions={
				<SubmitActions
					label={
						state.review === 'changes_requested'
							? 'Resubmit for review'
							: 'Submit for review'
					}
					onSubmit={submit}
					ready={ready}
					variant={variant}
				/>
			}
			basePath={`/dashboard/servers/${encodeURIComponent(serverReference(server))}`}
			checks={checks}
			variant={variant}
		/>
	)
}

/** Plugins are submitted by sending a build, so Submit leads to Versions. */
export function PluginChecklist({
	draftId,
	variant,
}: {
	draftId: Id<'pluginPublishingDrafts'>
	variant: PanelVariant
}) {
	const plugin = usePluginForEdit(draftId)
	const auth = useConvexAuth()
	const now = useMinute()
	const builds = useQuery(
		api.functions.plugins.publishing.model.listBuilds,
		auth.isAuthenticated ? { draftId, now } : 'skip',
	)
	const gallery = useQuery(
		api.functions.plugins.gallery.listMine,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
	if (!plugin || gallery === undefined) {
		return null
	}
	const state = creatorListingState({
		...plugin.project,
		locked: plugin.locked,
	})
	if (!state.canSubmit || state.locked) {
		return null
	}
	const base = `/dashboard/plugins/${createPluginDashboardId(plugin.repository.githubRepositoryId)}`
	const checks = pluginSubmissionChecklist({
		draft: plugin.draft,
		builds,
		hasGallery: gallery.length > 0,
	})
	const ready = checks.every((check) => !check.required || check.complete)
	const chooseBuild = (label: string) =>
		ready ? (
			<Link
				className={cn(buttonVariants(), variant === 'rail' && 'w-full')}
				href={`${base}/versions`}
			>
				{label}
			</Link>
		) : (
			<Button
				className={cn(variant === 'rail' && 'w-full')}
				disabled
				type="button"
			>
				{label}
			</Button>
		)
	const preview = (
		<Link
			className={cn(
				'inline-flex min-h-9 items-center font-medium text-primary text-sm hover:underline',
				variant === 'rail' && 'self-center',
			)}
			href={`${base}/review`}
		>
			Preview listing
		</Link>
	)

	if (state.published) {
		if (!state.hasDraftChanges) {
			return null
		}
		return (
			<ChangesPanel
				actions={
					<>
						{chooseBuild('Choose a build to submit')}
						{preview}
					</>
				}
				message="Saved changes go live with your next approved version."
				variant={variant}
			/>
		)
	}
	return (
		<ChecklistPanel
			actions={
				variant === 'rail' ? (
					<>
						{chooseBuild('Choose a build to submit')}
						{preview}
					</>
				) : (
					<>
						{preview}
						{chooseBuild('Choose a build to submit')}
					</>
				)
			}
			basePath={base}
			checks={checks}
			variant={variant}
		/>
	)
}
