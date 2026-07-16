import { v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'

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

		// Get all published servers
		const servers = await ctx.db
			.query('servers')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()

		// Count servers per category
		return categories.map((category) => {
			const serverCount = servers.filter((server) =>
				server.categoryIds.includes(category._id),
			).length

			return {
				...category,
				serverCount,
			}
		})
	},
})

/**
 * List all categories with usage counts for admin taxonomy management.
 */
export const listAdmin = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to view categories')
		}
		if (user.role !== 'admin') {
			throw new Error('Only admins can view categories')
		}

		const categories = await ctx.db
			.query('serverCategories')
			.order('asc')
			.collect()
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
export const create = mutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to create categories')
		}
		if (user.role !== 'admin') {
			throw new Error('Only admins can create categories')
		}

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
export const update = mutation({
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
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to update categories')
		}
		if (user.role !== 'admin') {
			throw new Error('Only admins can update categories')
		}

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
export const remove = mutation({
	args: { id: v.id('serverCategories') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to delete categories')
		}
		if (user.role !== 'admin') {
			throw new Error('Only admins can delete categories')
		}

		// Manual check since Convex doesn't support array contains in filter.
		const servers = await ctx.db.query('servers').collect()
		const serversUsingCategory = servers.filter((s) =>
			s.categoryIds.includes(args.id),
		)

		if (serversUsingCategory.length > 0) {
			throw new Error(
				`Cannot delete category: ${serversUsingCategory.length} servers are using it`,
			)
		}

		await ctx.db.delete(args.id)
	},
})
