'use client'

import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'
import { api } from '@/convex/_generated/api'
import { contentStatus } from '@/lib/content-status'
import {
	pluginLifecycleStatus,
	pluginModerationStatus,
} from '@/lib/plugins/moderation-state'
import { AdminContentTable, type ContentTableRow } from './admin-content-table'

type AdminPlugin = FunctionReturnType<
	typeof api.functions.plugins.projects.listAdmin
>[number]

function toRow(plugin: AdminPlugin): ContentTableRow {
	const status = contentStatus({
		lifecycle:
			plugin.status === 'archived'
				? 'archived'
				: pluginLifecycleStatus(plugin),
		moderation: pluginModerationStatus(plugin),
		submission: plugin.submissionStatus,
		wasPublished: Boolean(plugin.publishedAt),
		// A build waiting for review on a plugin that is already live.
		pendingVersion:
			plugin.reviewStatus === 'inReview'
				? plugin.reviewVersion
				: undefined,
		waitingSince: plugin.submittedAt,
	})
	return {
		id: plugin.projectId,
		name: plugin.name,
		subtitle: `${plugin.ownerName ?? 'Unknown creator'} · ${plugin.software}`,
		iconUrl: plugin.iconUrl,
		status,
		version: plugin.latestVersion,
		downloads: plugin.downloadCount,
		updatedAt: plugin.updatedAt,
		reviewHref: `/moderation/plugins/${plugin.projectId}`,
		publicHref:
			plugin.status === 'published' && plugin.visibility === 'public'
				? `/plugins/${plugin.slug}`
				: undefined,
	}
}

export function AdminPluginsTable() {
	const plugins = useQuery(api.functions.plugins.projects.listAdmin, {})
	const rows = useMemo(() => plugins?.map(toRow), [plugins])
	return <AdminContentTable rows={rows} singular="Plugin" title="Plugins" />
}
