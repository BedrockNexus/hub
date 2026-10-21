import { ConvexError, v } from 'convex/values'

import { recordAdminAction } from '../../lib/audit'
import { validateWorkflowTemplate } from '../../../lib/plugins/workflow-templates'
import { internalQuery } from '../../_generated/server'
import { adminMutation, adminQuery } from '../../lib/functions'
import {
	listResolvedWorkflowTemplates,
	resolveWorkflowTemplate,
} from '../../lib/plugins/workflowTemplates'
import { workflowTemplateKeyValidator } from '../../schemas/plugins'

const workflowTemplateResultValidator = v.object({
	key: workflowTemplateKeyValidator,
	softwareId: v.id('serverSoftware'),
	softwareName: v.string(),
	softwareSlug: v.string(),
	label: v.string(),
	content: v.string(),
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

function workflowKey(label: string, softwareSlug: string) {
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
	return `${softwareSlug}:${slug}`
}

export const list = adminQuery({
	args: {},
	returns: v.array(workflowTemplateResultValidator),
	handler: async (ctx) => await listResolvedWorkflowTemplates(ctx),
})

export const create = adminMutation({
	args: {
		label: v.string(),
		softwareId: v.id('serverSoftware'),
		content: v.string(),
	},
	returns: v.object({
		key: workflowTemplateKeyValidator,
		version: v.number(),
	}),
	handler: async (ctx, args) => {
		const software = await ctx.db.get('serverSoftware', args.softwareId)
		if (!software) {
			throw new ConvexError({
				code: 'SERVER_SOFTWARE_NOT_FOUND',
				message: 'Server software not found.',
			})
		}
		const label = validatedLabel(args.label)
		const content = validatedContent(args.content)
		const key = workflowKey(label, software.slug)
		const existing = await ctx.db
			.query('pluginWorkflowTemplates')
			.withIndex('by_key', (query) => query.eq('key', key))
			.unique()
		if (existing) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_EXISTS',
				message:
					'A workflow with that name already exists for this server software.',
			})
		}
		const now = Date.now()
		await ctx.db.insert('pluginWorkflowTemplates', {
			key,
			softwareId: software._id,
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
		const existing = await ctx.db
			.query('pluginWorkflowTemplates')
			.withIndex('by_key', (query) => query.eq('key', args.key))
			.unique()
		if (!existing) {
			throw new ConvexError({
				code: 'WORKFLOW_TEMPLATE_NOT_FOUND',
				message: 'The workflow template was not found.',
			})
		}
		const content = validatedContent(args.content)
		const version = existing.version + 1
		await ctx.db.patch('pluginWorkflowTemplates', existing._id, {
			content,
			version,
			updatedBy: ctx.admin._id,
			updatedAt: Date.now(),
		})
		const label = existing.label ?? existing.key
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginWorkflowTemplate.save',
			targetType: 'pluginWorkflowTemplate',
			targetId: args.key,
			changes: {
				previousState: `version:${existing.version}`,
				resultingState: `version:${version}`,
			},
			reason: `Saved ${label} workflow template version ${version}.`,
		})
		return { key: existing.key, version }
	},
})

export const remove = adminMutation({
	args: { key: workflowTemplateKeyValidator },
	returns: v.null(),
	handler: async (ctx, args) => {
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
