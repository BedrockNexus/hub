import { ConvexError, v } from 'convex/values'

import { recordAdminAction } from '../../lib/audit'
import { validateWorkflowTemplate } from '../../../lib/plugins/adapters/workflow-templates'
import { internalQuery } from '../../_generated/server'
import { adminMutation, adminQuery } from '../../lib/functions'
import {
	isDefaultWorkflowTemplateKey,
	listResolvedWorkflowTemplates,
	resolveWorkflowTemplate,
} from '../../lib/plugins/workflowTemplates'
import { workflowTemplateKeyValidator } from '../../schemas/plugins'

const adapterIdValidator = v.union(
	v.literal('pocketmine-mp'),
	v.literal('powernukkitx'),
)
const buildSystemValidator = v.union(
	v.literal('composer'),
	v.literal('gradle'),
	v.literal('maven'),
)

const workflowTemplateResultValidator = v.object({
	key: workflowTemplateKeyValidator,
	adapterId: adapterIdValidator,
	buildSystem: buildSystemValidator,
	label: v.string(),
	content: v.string(),
	source: v.union(
		v.literal('default'),
		v.literal('override'),
		v.literal('custom'),
	),
	version: v.number(),
	updatedAt: v.optional(v.number()),
})

function validatedContent(content: string) {
	try {
		return validateWorkflowTemplate(content)
	} catch (error) {
		throw new ConvexError({
			code: 'INVALID_WORKFLOW_TEMPLATE',
			message:
				error instanceof Error
					? error.message
					: 'The workflow template is invalid.',
		})
	}
}

function validatedLabel(label: string) {
	const normalized = label.trim().replace(/\s+/g, ' ')
	if (normalized.length < 3 || normalized.length > 80) {
		throw new ConvexError({
			code: 'INVALID_WORKFLOW_LABEL',
			message: 'Workflow names must contain between 3 and 80 characters.',
		})
	}
	return normalized
}

function customWorkflowKey(
	label: string,
	adapterId: 'pocketmine-mp' | 'powernukkitx',
	buildSystem: 'composer' | 'gradle' | 'maven',
) {
	const slug = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48)
	if (!slug) {
		throw new ConvexError({
			code: 'INVALID_WORKFLOW_LABEL',
			message: 'The workflow name must contain letters or numbers.',
		})
	}
	return `custom:${adapterId}:${buildSystem}:${slug}`
}

function assertCompatibleBuildSystem(
	adapterId: 'pocketmine-mp' | 'powernukkitx',
	buildSystem: 'composer' | 'gradle' | 'maven',
) {
	if (
		(adapterId === 'pocketmine-mp' && buildSystem !== 'composer') ||
		(adapterId === 'powernukkitx' && buildSystem === 'composer')
	) {
		throw new ConvexError({
			code: 'INVALID_WORKFLOW_BUILD_SYSTEM',
			message:
				'That build system is not supported by the selected server software.',
		})
	}
}

export const list = adminQuery({
	args: {},
	returns: v.array(workflowTemplateResultValidator),
	handler: async (ctx) => await listResolvedWorkflowTemplates(ctx),
})

export const create = adminMutation({
	args: {
		label: v.string(),
		adapterId: adapterIdValidator,
		buildSystem: buildSystemValidator,
		content: v.string(),
	},
	returns: v.object({
		key: workflowTemplateKeyValidator,
		version: v.number(),
	}),
	handler: async (ctx, args) => {
		assertCompatibleBuildSystem(args.adapterId, args.buildSystem)
		const label = validatedLabel(args.label)
		const content = validatedContent(args.content)
		const key = customWorkflowKey(label, args.adapterId, args.buildSystem)
		const existing = await ctx.db
			.query('pluginWorkflowTemplates')
			.withIndex('by_key', (query) => query.eq('key', key))
			.unique()
		if (existing || isDefaultWorkflowTemplateKey(key)) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_EXISTS',
				message:
					'A workflow with that name, server software, and build system already exists.',
			})
		}
		const now = Date.now()
		await ctx.db.insert('pluginWorkflowTemplates', {
			key,
			adapterId: args.adapterId,
			buildSystem: args.buildSystem,
			label,
			content,
			version: 1,
			updatedBy: ctx.admin._id,
			createdAt: now,
			updatedAt: now,
		})
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginWorkflowTemplate.create',
			targetType: 'pluginWorkflowTemplate',
			targetId: key,
			changes: { previousState: 'missing', resultingState: 'version:1' },
			reason: `Created ${label} workflow template.`,
		})
		return { key, version: 1 }
	},
})

export const save = adminMutation({
	args: {
		key: workflowTemplateKeyValidator,
		content: v.string(),
	},
	returns: v.object({
		key: workflowTemplateKeyValidator,
		version: v.number(),
	}),
	handler: async (ctx, args) => {
		const resolved = await resolveWorkflowTemplate(ctx, args.key)
		if (!resolved) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_NOT_FOUND',
				message: 'The workflow template was not found.',
			})
		}
		const content = validatedContent(args.content)
		const existing = await ctx.db
			.query('pluginWorkflowTemplates')
			.withIndex('by_key', (query) => query.eq('key', args.key))
			.unique()
		const now = Date.now()
		const version = existing ? existing.version + 1 : 1
		if (existing) {
			await ctx.db.patch('pluginWorkflowTemplates', existing._id, {
				content,
				version,
				updatedBy: ctx.admin._id,
				updatedAt: now,
			})
		} else {
			await ctx.db.insert('pluginWorkflowTemplates', {
				key: resolved.key,
				adapterId: resolved.adapterId,
				buildSystem: resolved.buildSystem,
				content,
				version,
				updatedBy: ctx.admin._id,
				createdAt: now,
				updatedAt: now,
			})
		}
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginWorkflowTemplate.save',
			targetType: 'pluginWorkflowTemplate',
			targetId: args.key,
			changes: {
				previousState: existing
					? `version:${existing.version}`
					: 'default',
				resultingState: `version:${version}`,
			},
			reason: `Saved ${resolved.label} workflow template version ${version}.`,
		})
		return { key: resolved.key, version }
	},
})

export const reset = adminMutation({
	args: { key: workflowTemplateKeyValidator },
	returns: v.null(),
	handler: async (ctx, args) => {
		if (!isDefaultWorkflowTemplateKey(args.key)) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_NOT_DEFAULT',
				message:
					'Custom workflows can be deleted, but they cannot be restored to a default.',
			})
		}
		const resolved = await resolveWorkflowTemplate(ctx, args.key)
		const existing = await ctx.db
			.query('pluginWorkflowTemplates')
			.withIndex('by_key', (query) => query.eq('key', args.key))
			.unique()
		if (!existing) {
			return null
		}
		await ctx.db.delete('pluginWorkflowTemplates', existing._id)
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginWorkflowTemplate.reset',
			targetType: 'pluginWorkflowTemplate',
			targetId: args.key,
			changes: {
				previousState: `version:${existing.version}`,
				resultingState: 'default',
			},
			reason: `Reset ${resolved?.label ?? args.key} to its code-defined default.`,
		})
		return null
	},
})

export const remove = adminMutation({
	args: { key: workflowTemplateKeyValidator },
	returns: v.null(),
	handler: async (ctx, args) => {
		if (isDefaultWorkflowTemplateKey(args.key)) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_PROTECTED',
				message: 'Code-defined workflows cannot be deleted.',
			})
		}
		const existing = await ctx.db
			.query('pluginWorkflowTemplates')
			.withIndex('by_key', (query) => query.eq('key', args.key))
			.unique()
		if (!existing) {
			return null
		}
		const selectedDraft = await ctx.db
			.query('pluginPublishingDrafts')
			.withIndex('by_workflow_template_key', (query) =>
				query.eq('workflowTemplateKey', args.key),
			)
			.first()
		if (selectedDraft) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_IN_USE',
				message:
					'This workflow is selected by a project and cannot be deleted.',
			})
		}
		await ctx.db.delete('pluginWorkflowTemplates', existing._id)
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginWorkflowTemplate.delete',
			targetType: 'pluginWorkflowTemplate',
			targetId: args.key,
			changes: {
				previousState: `version:${existing.version}`,
				resultingState: 'deleted',
			},
			reason: `Deleted ${existing.label ?? args.key} workflow template.`,
		})
		return null
	},
})

export const getTemplate = internalQuery({
	args: { key: workflowTemplateKeyValidator },
	returns: v.union(workflowTemplateResultValidator, v.null()),
	handler: async (ctx, args) => await resolveWorkflowTemplate(ctx, args.key),
})
