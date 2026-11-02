import { ConvexError, v } from 'convex/values'
import {
	parseWorkflowCatalog,
	WORKFLOW_CATALOG_LIMIT,
	WORKFLOW_REPOSITORY,
} from '../../../lib/plugins/workflow-catalog'
import { validateWorkflowTemplate } from '../../../lib/plugins/workflow-templates'
import { internalMutation, internalQuery } from '../../_generated/server'
import { authComponent } from '../../auth'
import { adminMutation, adminQuery } from '../../lib/functions'
import {
	listResolvedWorkflowTemplates,
	resolveWorkflowTemplate,
} from '../../lib/plugins/workflowTemplates'
import { workflowTemplateKeyValidator } from '../../schemas/plugins'

const resultValidator = v.object({
	key: workflowTemplateKeyValidator,
	softwareId: v.id('serverSoftware'),
	softwareName: v.string(),
	softwareSlug: v.string(),
	label: v.string(),
	content: v.string(),
	version: v.number(),
	updatedAt: v.optional(v.number()),
	sourceCommit: v.optional(v.string()),
	sourcePath: v.optional(v.string()),
})

export const list = adminQuery({
	args: {},
	returns: v.array(resultValidator),
	handler: async (ctx) => await listResolvedWorkflowTemplates(ctx),
})

export const getTemplate = internalQuery({
	args: { key: workflowTemplateKeyValidator },
	returns: v.union(resultValidator, v.null()),
	handler: async (ctx, args) => await resolveWorkflowTemplate(ctx, args.key),
})

export const status = adminQuery({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			lastAttemptAt: v.number(),
			lastSyncedAt: v.optional(v.number()),
			sourceCommit: v.optional(v.string()),
			lastError: v.optional(v.string()),
		}),
	),
	handler: async (ctx) => {
		const state = await ctx.db
			.query('pluginWorkflowCatalogState')
			.withIndex('by_key', (q) => q.eq('key', WORKFLOW_REPOSITORY))
			.unique()
		return state
			? {
					lastAttemptAt: state.lastAttemptAt,
					lastSyncedAt: state.lastSyncedAt,
					sourceCommit: state.sourceCommit,
					lastError: state.lastError,
				}
			: null
	},
})

export const authorizeRefresh = internalQuery({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (user.role !== 'admin') throw new ConvexError('Admin role required')
		return null
	},
})

export const beginRefresh = internalMutation({
	args: {},
	returns: v.union(v.null(), v.number()),
	handler: async (ctx) => {
		const state = await ctx.db
			.query('pluginWorkflowCatalogState')
			.withIndex('by_key', (q) => q.eq('key', WORKFLOW_REPOSITORY))
			.unique()
		const now = Date.now()
		if (state && now - state.lastAttemptAt < 60_000) return null
		const generation = (state?.generation ?? 0) + 1
		if (state)
			await ctx.db.patch(state._id, { generation, lastAttemptAt: now })
		else
			await ctx.db.insert('pluginWorkflowCatalogState', {
				key: WORKFLOW_REPOSITORY,
				generation,
				lastAttemptAt: now,
			})
		return generation
	},
})

export const recordRefreshError = internalMutation({
	args: { generation: v.number(), message: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const state = await ctx.db
			.query('pluginWorkflowCatalogState')
			.withIndex('by_key', (q) => q.eq('key', WORKFLOW_REPOSITORY))
			.unique()
		if (state?.generation === args.generation)
			await ctx.db.patch(state._id, {
				lastError: args.message.slice(0, 300),
			})
		return null
	},
})

export const applyCatalog = internalMutation({
	args: {
		generation: v.number(),
		commit: v.string(),
		templates: v.array(
			v.object({
				key: v.string(),
				softwareSlug: v.string(),
				label: v.string(),
				path: v.string(),
				content: v.string(),
			}),
		),
	},
	returns: v.union(
		v.null(),
		v.object({
			updated: v.number(),
			retired: v.number(),
			commit: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const state = await ctx.db
			.query('pluginWorkflowCatalogState')
			.withIndex('by_key', (q) => q.eq('key', WORKFLOW_REPOSITORY))
			.unique()
		if (!state || state.generation !== args.generation) return null
		if (!/^[a-f0-9]{40}$/.test(args.commit))
			throw new Error('Invalid catalog commit.')
		parseWorkflowCatalog({ schemaVersion: 1, templates: args.templates })
		const current = await ctx.db.query('pluginWorkflowTemplates').take(201)
		if (
			current.length > 200 ||
			args.templates.length > WORKFLOW_CATALOG_LIMIT
		)
			throw new Error('Workflow catalog cache limit reached.')
		const keys = new Set(args.templates.map((entry) => entry.key))
		const newCount = args.templates.filter(
			(entry) => !current.some((row) => row.key === entry.key),
		).length
		if (current.length + newCount > 200)
			throw new Error('Workflow catalog cache limit reached.')
		let updated = 0
		let retired = 0
		const now = Date.now()
		for (const entry of args.templates) {
			validateWorkflowTemplate(entry.content)
			const software = await ctx.db
				.query('serverSoftware')
				.withIndex('by_slug', (q) => q.eq('slug', entry.softwareSlug))
				.unique()
			if (!software)
				throw new Error(
					`Add server software ${entry.softwareSlug} before refreshing its workflow template.`,
				)
			const existing = current.find((row) => row.key === entry.key)
			if (existing && existing.softwareId !== software._id)
				throw new Error(
					`Workflow key ${entry.key} cannot change server software. Use a new key.`,
				)
			const changed =
				!existing ||
				existing.content !== entry.content ||
				existing.label !== entry.label ||
				existing.active === false ||
				existing.sourcePath !== entry.path
			const values = {
				softwareId: software._id,
				label: entry.label,
				content: entry.content,
				active: true,
				sourceCommit: args.commit,
				sourcePath: entry.path,
			}
			if (existing)
				await ctx.db.patch(existing._id, {
					...values,
					...(changed
						? { version: existing.version + 1, updatedAt: now }
						: {}),
				})
			else
				await ctx.db.insert('pluginWorkflowTemplates', {
					key: entry.key,
					...values,
					version: 1,
					updatedBy: WORKFLOW_REPOSITORY,
					createdAt: now,
					updatedAt: now,
				})
			if (changed) updated++
		}
		for (const row of current) {
			if (!keys.has(row.key) && row.active !== false) {
				await ctx.db.patch(row._id, { active: false, updatedAt: now })
				retired++
			}
		}
		await ctx.db.patch(state._id, {
			sourceCommit: args.commit,
			lastSyncedAt: now,
			lastError: undefined,
		})
		return { updated, retired, commit: args.commit }
	},
})

// Reject older clients rather than letting them create a second source of truth.
function repositoryManaged(): never {
	throw new ConvexError({
		code: 'WORKFLOW_REPOSITORY_MANAGED',
		message:
			'Workflow templates are maintained in BedrockNexus/plugin-workflows. Update the repository and refresh the catalog.',
	})
}
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
	handler: repositoryManaged,
})
export const save = adminMutation({
	args: {
		key: workflowTemplateKeyValidator,
		content: v.string(),
		label: v.optional(v.string()),
		softwareId: v.optional(v.id('serverSoftware')),
	},
	returns: v.object({
		key: workflowTemplateKeyValidator,
		version: v.number(),
	}),
	handler: repositoryManaged,
})
export const remove = adminMutation({
	args: { key: workflowTemplateKeyValidator },
	returns: v.null(),
	handler: repositoryManaged,
})
