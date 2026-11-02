import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'

/**
 * Reactive read model of BedrockNexus/plugin-workflows. A scheduled action
 * refreshes this cache atomically from one repository commit. Legacy rows stay
 * available until the first successful refresh; retired entries are retained
 * for history but cannot be selected or installed.
 */

type DatabaseCtx = QueryCtx | MutationCtx

export type ResolvedWorkflowTemplate = {
	key: string
	softwareId: Id<'serverSoftware'>
	softwareName: string
	softwareSlug: string
	label: string
	content: string
	version: number
	updatedAt?: number
	sourceCommit?: string
	sourcePath?: string
}

const TEMPLATE_LIMIT = 200

async function toResolved(
	ctx: DatabaseCtx,
	template: Doc<'pluginWorkflowTemplates'>,
): Promise<ResolvedWorkflowTemplate | null> {
	const software = await ctx.db.get('serverSoftware', template.softwareId)
	if (!software || template.active === false) {
		return null
	}
	return {
		key: template.key,
		softwareId: software._id,
		softwareName: software.name,
		softwareSlug: software.slug,
		label: template.label ?? template.key,
		content: template.content,
		version: template.version,
		updatedAt: template.updatedAt,
		sourceCommit: template.sourceCommit,
		sourcePath: template.sourcePath,
	}
}

export async function listResolvedWorkflowTemplates(ctx: DatabaseCtx) {
	const stored = await ctx.db
		.query('pluginWorkflowTemplates')
		.take(TEMPLATE_LIMIT)
	const resolved = await Promise.all(
		stored.map((template) => toResolved(ctx, template)),
	)
	return resolved
		.filter(
			(template): template is ResolvedWorkflowTemplate =>
				template !== null,
		)
		.sort(
			(left, right) =>
				left.softwareName.localeCompare(right.softwareName) ||
				left.label.localeCompare(right.label),
		)
}

export async function resolveWorkflowTemplate(ctx: DatabaseCtx, key: string) {
	const stored = await ctx.db
		.query('pluginWorkflowTemplates')
		.withIndex('by_key', (query) => query.eq('key', key))
		.unique()
	return stored ? await toResolved(ctx, stored) : null
}

/** Software that has at least one workflow, so plugins can be published for it. */
export async function softwareIdsWithWorkflows(
	ctx: DatabaseCtx,
): Promise<ReadonlySet<string>> {
	const templates = await ctx.db
		.query('pluginWorkflowTemplates')
		.take(TEMPLATE_LIMIT)
	return new Set(
		templates
			.filter((template) => template.active !== false)
			.map((template) => template.softwareId),
	)
}
