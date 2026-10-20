import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'

/**
 * Publishing workflows live only in `pluginWorkflowTemplates`: admins add,
 * edit and delete them at /admin/plugins/workflows, and no workflow ships with
 * the code. Each belongs to one server software, and picking one is how a
 * developer says which software their plugin is for. A software accepts
 * plugins when it has a plugin file type (/admin/server-software) and at least
 * one workflow.
 */

type DatabaseCtx = QueryCtx | MutationCtx

export type ResolvedWorkflowTemplate = {
	key: string
	softwareId: Id<'serverSoftware'>
	softwareName: string
	softwareSlug: string
	// The plugin file type of the software, e.g. "phar". Undefined while the
	// software does not accept plugins.
	fileExtension?: string
	label: string
	content: string
	version: number
	updatedAt?: number
}

const TEMPLATE_LIMIT = 200

async function toResolved(
	ctx: DatabaseCtx,
	template: Doc<'pluginWorkflowTemplates'>,
): Promise<ResolvedWorkflowTemplate | null> {
	if (!template.softwareId) {
		return null
	}
	const software = await ctx.db.get('serverSoftware', template.softwareId)
	if (!software) {
		return null
	}
	return {
		key: template.key,
		softwareId: software._id,
		softwareName: software.name,
		softwareSlug: software.slug,
		fileExtension: software.pluginFileExtension,
		label: template.label ?? template.key,
		content: template.content,
		version: template.version,
		updatedAt: template.updatedAt,
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
