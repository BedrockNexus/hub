'use client'

import { PuzzleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/convex/_generated/api'
import { moderationReviewHref } from '@/lib/admin-review-navigation'
import { contentHref } from '@/lib/content-routes'
import { contentStatus } from '@/lib/content-status'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
	PROJECT_TYPE_PLURAL_LABELS,
	type ProjectType,
} from '@/lib/project-artifacts'
import { AdminContentTable, type ContentTableRow } from './admin-content-table'

type AdminProject = FunctionReturnType<
	typeof api.functions.projects.projects.listAdmin
>[number]

function toRow(project: AdminProject): ContentTableRow {
	const status = contentStatus({
		lifecycle: project.status ?? 'draft',
		moderation: project.moderationStatus,
		submission: project.submissionStatus,
		wasPublished: Boolean(project.publishedAt),
		pendingVersion: project.pendingVersion?.version,
		waitingSince:
			project.submissionStatus === 'pending'
				? project.submittedAt
				: project.pendingVersion?.since,
	})
	const isPublic =
		project.status === 'published' &&
		project.moderationStatus === 'approved'
	return {
		id: project._id,
		name: project.name,
		subtitle: `by ${project.ownerName}`,
		iconUrl: project.iconUrl,
		status,
		version: project.latestVersionString,
		downloads: project.totalDownloads,
		updatedAt: project.updatedAt ?? project._creationTime,
		// A waiting version opens straight on its own review.
		reviewHref: moderationReviewHref('projects', project._id, {
			projectType: project.type,
			releaseId:
				project.submissionStatus === 'pending'
					? undefined
					: project.pendingVersion?.id,
		}),
		publicHref: isPublic
			? contentHref(
					project.type,
					project.slug,
					project._id,
					project.publicId,
				)
			: undefined,
	}
}

export function AdminProjectsTable({ type }: { type: ProjectType }) {
	const plural = PROJECT_TYPE_PLURAL_LABELS[type]
	const projects = useQuery(api.functions.projects.projects.listAdmin, {
		limit: 250,
	})
	const rows = useMemo(
		() =>
			projects
				?.filter(
					(project) => normalizeProjectType(project.type) === type,
				)
				.map(toRow),
		[projects, type],
	)
	return (
		<AdminContentTable
			empty={
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<HugeiconsIcon
								className="size-7"
								icon={PuzzleIcon}
							/>
						</div>
						<div>
							<h2 className="font-semibold text-lg">
								No {plural.toLowerCase()} yet
							</h2>
							<p className="text-muted-foreground text-sm">
								{plural} will appear here when creators add
								them.
							</p>
						</div>
					</CardContent>
				</Card>
			}
			rows={rows}
			singular={PROJECT_TYPE_LABELS[type]}
			title={plural}
		/>
	)
}
