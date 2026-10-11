import {
	getDefaultWorkflowTemplate,
	getWorkflowTemplateDescriptor,
	WORKFLOW_TEMPLATE_DESCRIPTORS,
	WORKFLOW_TEMPLATE_KEYS,
	type WorkflowTemplateKey,
} from '../../../lib/plugins/adapters/workflow-templates'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'

type DatabaseCtx = QueryCtx | MutationCtx

export type WorkflowAdapterId = 'pocketmine-mp' | 'powernukkitx'
export type WorkflowBuildSystem = 'composer' | 'gradle' | 'maven'
export type WorkflowTemplateSource = 'default' | 'override' | 'custom'

export type ResolvedWorkflowTemplate = {
	key: string
	adapterId: WorkflowAdapterId
	buildSystem: WorkflowBuildSystem
	label: string
	content: string
	source: WorkflowTemplateSource
	version: number
	updatedAt?: number
}

export function isDefaultWorkflowTemplateKey(
	key: string,
): key is WorkflowTemplateKey {
	return (WORKFLOW_TEMPLATE_KEYS as readonly string[]).includes(key)
}

function resolveDefaultTemplate(
	key: WorkflowTemplateKey,
	override?: Doc<'pluginWorkflowTemplates'>,
): ResolvedWorkflowTemplate {
	const descriptor = getWorkflowTemplateDescriptor(key)
	return {
		key,
		adapterId: descriptor.adapterId,
		buildSystem: descriptor.buildSystem,
		label: descriptor.label,
		content: override?.content ?? getDefaultWorkflowTemplate(key),
		source: override ? 'override' : 'default',
		version: override?.version ?? 1,
		updatedAt: override?.updatedAt,
	}
}

function resolveCustomTemplate(
	template: Doc<'pluginWorkflowTemplates'>,
): ResolvedWorkflowTemplate {
	return {
		key: template.key,
		adapterId: template.adapterId,
		buildSystem: template.buildSystem,
		label: template.label ?? template.key,
		content: template.content,
		source: 'custom',
		version: template.version,
		updatedAt: template.updatedAt,
	}
}

export async function listResolvedWorkflowTemplates(
	ctx: DatabaseCtx,
	adapterId?: WorkflowAdapterId,
) {
	const stored = await ctx.db.query('pluginWorkflowTemplates').take(200)
	const byKey = new Map(stored.map((template) => [template.key, template]))
	const defaults = WORKFLOW_TEMPLATE_DESCRIPTORS.map((descriptor) =>
		resolveDefaultTemplate(descriptor.key, byKey.get(descriptor.key)),
	)
	const custom = stored
		.filter((template) => !isDefaultWorkflowTemplateKey(template.key))
		.map(resolveCustomTemplate)

	return [...defaults, ...custom]
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

	if (isDefaultWorkflowTemplateKey(key)) {
		return resolveDefaultTemplate(key, stored ?? undefined)
	}
	return stored ? resolveCustomTemplate(stored) : null
}
