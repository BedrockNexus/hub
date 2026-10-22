import { ConvexError, v } from 'convex/values'

import type { Doc } from '../../_generated/dataModel'
import { query, type QueryCtx } from '../../_generated/server'
import { recordAdminAction } from '../../lib/audit'
import { adminMutation, adminQuery } from '../../lib/functions'

/**
 * Plugin categories, managed by admins next to server and project categories
 * (/admin/categories). Developers pick them in their plugin's settings
 * (publishing/model:saveCategories); listings filter by them.
 */

const NAME_MAX = 40
const DESCRIPTION_MAX = 200
// Plugins are few for now; counting by scanning is cheaper than counters.
const COUNT_SCAN_LIMIT = 2000

function slugFor(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

function validated(name: string, description: string | undefined) {
	const trimmed = name.trim()
	if (trimmed.length < 2 || trimmed.length > NAME_MAX) {
		throw new ConvexError(`Names must be between 2 and ${NAME_MAX} characters`)
	}
	const slug = slugFor(trimmed)
	if (!slug) {
		throw new ConvexError('Names must contain letters or numbers')
	}
	const text = description?.trim() || undefined
	if (text && text.length > DESCRIPTION_MAX) {
		throw new ConvexError(
			`Descriptions must be at most ${DESCRIPTION_MAX} characters`,
		)
	}
	return { name: trimmed, slug, description: text }
}

const publicCategoryValidator = v.object({
	_id: v.id('pluginCategories'),
	name: v.string(),
	slug: v.string(),
	description: v.optional(v.string()),
})

function toPublic(category: Doc<'pluginCategories'>) {
	return {
		_id: category._id,
		name: category.name,
		slug: category.slug,
		description: category.description,
	}
}

/** Active categories in display order. */
export async function listActiveCategories(ctx: QueryCtx) {
	return await ctx.db
		.query('pluginCategories')
		.withIndex('by_is_active_and_sort_order', (q) => q.eq('isActive', true))
		.take(100)
}

export const list = query({
	args: {},
	returns: v.array(publicCategoryValidator),
	handler: async (ctx) => (await listActiveCategories(ctx)).map(toPublic),
})

export const listAdmin = adminQuery({
	args: {},
	handler: async (ctx) => {
		const [categories, plugins] = await Promise.all([
			ctx.db.query('pluginCategories').withIndex('by_sort_order').take(200),
			ctx.db.query('plugins').take(COUNT_SCAN_LIMIT),
		])
		return categories.map((category) => {
			const using = plugins.filter((plugin) =>
				plugin.categoryIds?.includes(category._id),
			)
			return {
				...category,
				pluginCount: using.length,
				publishedPluginCount: using.filter(
					(plugin) => plugin.status === 'published',
				).length,
			}
		})
	},
})

export const create = adminMutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
	},
	returns: v.id('pluginCategories'),
	handler: async (ctx, args) => {
		const fields = validated(args.name, args.description)
		const existing = await ctx.db
			.query('pluginCategories')
			.withIndex('by_slug', (q) => q.eq('slug', fields.slug))
			.unique()
		if (existing) {
			throw new ConvexError('A category with this name already exists')
		}
		const now = Date.now()
		const id = await ctx.db.insert('pluginCategories', {
			...fields,
			icon: args.icon?.trim() || undefined,
			color: args.color?.trim() || undefined,
			sortOrder: args.sortOrder ?? now,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		})
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginCategory.create',
			targetType: 'pluginCategory',
			targetId: id,
			targetLabel: fields.name,
		})
		return id
	},
})

export const update = adminMutation({
	args: {
		id: v.id('pluginCategories'),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
		isActive: v.optional(v.boolean()),
	},
	returns: v.id('pluginCategories'),
	handler: async (ctx, args) => {
		const category = await ctx.db.get('pluginCategories', args.id)
		if (!category) {
			throw new ConvexError('Category not found')
		}
		const fields = validated(
			args.name ?? category.name,
			args.description ?? category.description,
		)
		if (fields.slug !== category.slug) {
			const existing = await ctx.db
				.query('pluginCategories')
				.withIndex('by_slug', (q) => q.eq('slug', fields.slug))
				.unique()
			if (existing) {
				throw new ConvexError('A category with this name already exists')
			}
		}
		await ctx.db.patch('pluginCategories', category._id, {
			...fields,
			// The admin form always sends both; empty clears them.
			icon: args.icon?.trim() || undefined,
			color: args.color?.trim() || undefined,
			...(args.sortOrder !== undefined ? { sortOrder: args.sortOrder } : {}),
			...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
			updatedAt: Date.now(),
		})
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginCategory.update',
			targetType: 'pluginCategory',
			targetId: category._id,
			targetLabel: fields.name,
		})
		return category._id
	},
})

export const remove = adminMutation({
	args: { id: v.id('pluginCategories') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const category = await ctx.db.get('pluginCategories', args.id)
		if (!category) {
			return null
		}
		const plugins = await ctx.db.query('plugins').take(COUNT_SCAN_LIMIT)
		const usage = plugins.filter((plugin) =>
			plugin.categoryIds?.includes(category._id),
		).length
		if (usage > 0) {
			throw new ConvexError(
				`Cannot delete category: ${usage} plugins are using it. Deactivate it instead.`,
			)
		}
		await ctx.db.delete('pluginCategories', category._id)
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pluginCategory.remove',
			targetType: 'pluginCategory',
			targetId: category._id,
			targetLabel: category.name,
		})
		return null
	},
})
