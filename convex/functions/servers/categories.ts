import { v } from 'convex/values'
import { query } from '../../_generated/server'
import { adminMutation, adminQuery } from '../../lib/functions'

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List all active categories
 */
export const list = query({
	args: {
		includeInactive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		if (args.includeInactive) {
			return ctx.db.query('serverCategories').order('asc').collect()
		}

		return ctx.db
			.query('serverCategories')
			.withIndex('by_active', (q) => q.eq('isActive', true))
			.collect()
	},
})

/**
 * Get a category by slug
 */
export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query('serverCategories')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.first()
	},
})

/**
 * Get a category by ID
 */
export const getById = query({
	args: { id: v.id('serverCategories') },
	handler: async (ctx, args) => {
		return ctx.db.get(args.id)
	},
})

/**
 * Get categories with server counts
 */
export const listWithCounts = query({
	args: {},
	handler: async (ctx) => {
		const categories = await ctx.db
			.query('serverCategories')
			.withIndex('by_active', (q) => q.eq('isActive', true))
			.collect()

		// Counters maintained by lib/categoryCounts.ts; scan only until the
		// backfill has written them.
		if (
			categories.every(
				(category) => category.publishedServerCount !== undefined,
			)
		) {
			return categories.map((category) => ({
				...category,
				serverCount: category.publishedServerCount ?? 0,
			}))
		}

		const servers = await ctx.db
			.query('servers')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()

		return categories.map((category) => ({
			...category,
			serverCount: servers.filter((server) =>
				server.categoryIds.includes(category._id),
			).length,
		}))
	},
})

/**
 * List all categories with usage counts for admin taxonomy management.
 */
export const listAdmin = adminQuery({
	args: {},
	handler: async (ctx) => {
		const categories = await ctx.db
			.query('serverCategories')
			.order('asc')
			.collect()
		if (categories.every((category) => category.serverCount !== undefined)) {
			return categories.map((category) => ({
				...category,
				serverCount: category.serverCount ?? 0,
				publishedServerCount: category.publishedServerCount ?? 0,
			}))
		}

		// Counters not backfilled yet (servers/migrations:backfillCategoryCounts).
		const servers = await ctx.db.query('servers').collect()
		return categories.map((category) => {
			const categoryServers = servers.filter((server) =>
				server.categoryIds.includes(category._id),
			)

			return {
				...category,
				serverCount: categoryServers.length,
				publishedServerCount: categoryServers.filter(
					(server) => server.status === 'published',
				).length,
			}
		})
	},
})

// =============================================================================
// MUTATIONS (Admin only)
// =============================================================================

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

/**
 * Create a new category
 */
export const create = adminMutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const slug = generateSlug(args.name)

		// Check for duplicate slug
		const existing = await ctx.db
			.query('serverCategories')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.first()

		if (existing) {
			throw new Error('A category with this name already exists')
		}

		return ctx.db.insert('serverCategories', {
			name: args.name,
			slug,
			description: args.description,
			icon: args.icon,
			color: args.color,
			sortOrder: args.sortOrder ?? Date.now(),
			isActive: true,
		})
	},
})

/**
 * Update a category
 */
export const update = adminMutation({
	args: {
		id: v.id('serverCategories'),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
		isActive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { id, ...updates } = args

		// Update slug if name changed
		if (updates.name) {
			const slug = generateSlug(updates.name)
			const existing = await ctx.db
				.query('serverCategories')
				.withIndex('by_slug', (q) => q.eq('slug', slug))
				.first()

			if (existing && existing._id !== id) {
				throw new Error('A category with this name already exists')
			}

			await ctx.db.patch(id, { ...updates, slug })
		} else {
			await ctx.db.patch(id, updates)
		}

		return id
	},
})

/**
 * Delete a category
 */
export const remove = adminMutation({
	args: { id: v.id('serverCategories') },
	handler: async (ctx, args) => {
		const category = await ctx.db.get(args.id)
		const usage =
			category?.serverCount ??
			// Counters not backfilled yet: fall back to scanning.
			(await ctx.db.query('servers').collect()).filter((server) =>
				server.categoryIds.includes(args.id),
			).length

		if (usage > 0) {
			throw new Error(`Cannot delete category: ${usage} servers are using it`)
		}

		await ctx.db.delete(args.id)
	},
})
