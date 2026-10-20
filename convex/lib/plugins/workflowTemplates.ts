import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'

/**
 * Publishing workflows live only in `pluginWorkflowTemplates`: admins add,
 * edit and delete them at /admin/plugins/workflows, and no workflow ships with
 * the code. A server software has no publishing workflow until an admin adds
 * one for it.
 */

type DatabaseCtx = QueryCtx | MutationCtx

export type WorkflowAdapterId = 'pocketmine-mp' | 'powernukkitx'
export type WorkflowBuildSystem = 'composer' | 'gradle' | 'maven'

export type ResolvedWorkflowTemplate = {
	key: string
	adapterId: WorkflowAdapterId
	buildSystem: WorkflowBuildSystem
	label: string
	content: string
	version: number
	updatedAt?: number
}

const TEMPLATE_LIMIT = 200

function toResolved(
	template: Doc<'pluginWorkflowTemplates'>,
): ResolvedWorkflowTemplate {
	return {
		key: template.key,
		adapterId: template.adapterId,
		buildSystem: template.buildSystem,
		label: template.label ?? template.key,
		content: template.content,
		version: template.version,
		updatedAt: template.updatedAt,
	}
}

export async function listResolvedWorkflowTemplates(
	ctx: DatabaseCtx,
	adapterId?: WorkflowAdapterId,
) {
	const stored = await ctx.db
		.query('pluginWorkflowTemplates')
		.take(TEMPLATE_LIMIT)
	return stored
		.map(toResolved)
		.filter((template) => !adapterId || template.adapterId === adapterId)
		.sort(
			(left, right) =>
				left.adapterId.localeCompare(right.adapterId) ||
				left.buildSystem.localeCompare(right.buildSystem) ||
				left.label.localeCompare(right.label),
		)
}

export async function resolveWorkflowTemplate(ctx: DatabaseCtx, key: string) {
	const stored = await ctx.db
		.query('pluginWorkflowTemplates')
		.withIndex('by_key', (query) => query.eq('key', key))
		.unique()
	return stored ? toResolved(stored) : null
}
