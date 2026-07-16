import { v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { projectType } from '../../schemas/projects'

// =============================================================================
// HELPERS
// =============================================================================

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List all active project categories
 */
export const list = query({
	args: {
		projectType: v.optional(projectType),
		includeInactive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const type = args.projectType

		if (type) {
			const all = await ctx.db
				.query('projectCategories')
				.withIndex('by_type', (q) => q.eq('projectType', type))
				.collect()
			if (args.includeInactive) return all
			return all.filter((c) => c.isActive)
		}

		if (args.includeInactive) {
			return ctx.db.query('projectCategories').order('asc').collect()
		}

		return ctx.db
			.query('projectCategories')
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
			.query('projectCategories')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.first()
	},
})

/**
 * Get a category by ID
 */
export const getById = query({
	args: { id: v.id('projectCategories') },
	handler: async (ctx, args) => {
		return ctx.db.get(args.id)
	},
})

/**
 * List categories with project counts
 */
export const listWithCounts = query({
	args: {},
	handler: async (ctx) => {
		const categories = await ctx.db
			.query('projectCategories')
			.order('asc')
			.collect()

		const items = await ctx.db
			.query('projects')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()

		return categories.map((category) => {
			const projectCount = items.filter((item) =>
				item.categoryIds.includes(category._id),
			).length

			return {
				...category,
				projectCount,
				// Backwards-compat alias for older callers
				contentCount: projectCount,
			}
		})
	},
})

/**
 * List all project categories with usage counts for admin taxonomy management.
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
			.query('projectCategories')
			.order('asc')
			.collect()
		const projects = await ctx.db.query('projects').collect()

		return categories.map((category) => {
			const categoryProjects = projects.filter((project) =>
				project.categoryIds.includes(category._id),
			)

			return {
				...category,
				projectCount: categoryProjects.length,
				publishedProjectCount: categoryProjects.filter(
					(project) => project.status === 'published',
				).length,
				contentCount: categoryProjects.length,
			}
		})
	},
})

// =============================================================================
// MUTATIONS (Admin only)
// =============================================================================

/**
 * Create a new project category
 */
export const create = mutation({
	args: {
		projectType: projectType,
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

		const existing = await ctx.db
			.query('projectCategories')
			.withIndex('by_type_and_slug', (q) =>
				q.eq('projectType', args.projectType).eq('slug', slug),
			)
			.first()

		if (existing) {
			throw new Error(
				'A category with this name already exists for this project type',
			)
		}

		const now = Date.now()
		return ctx.db.insert('projectCategories', {
			projectType: args.projectType,
			name: args.name,
			slug,
			description: args.description,
			icon: args.icon,
			color: args.color,
			sortOrder: args.sortOrder ?? now,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		})
	},
})

/**
 * Update a category
 */
export const update = mutation({
	args: {
		id: v.id('projectCategories'),
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
		const now = Date.now()

		if (updates.name) {
			const slug = generateSlug(updates.name)
			const category = await ctx.db.get(id)
			if (!category) throw new Error('Category not found')

			const existing = await ctx.db
				.query('projectCategories')
				.withIndex('by_type_and_slug', (q) =>
					q.eq('projectType', category.projectType).eq('slug', slug),
				)
				.first()

			if (existing && existing._id !== id) {
				throw new Error(
					'A category with this name already exists for this project type',
				)
			}

			await ctx.db.patch(id, { ...updates, slug, updatedAt: now })
		} else {
			await ctx.db.patch(id, { ...updates, updatedAt: now })
		}

		return id
	},
})

/**
 * Delete a category
 */
export const remove = mutation({
	args: { id: v.id('projectCategories') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to delete categories')
		}
		if (user.role !== 'admin') {
			throw new Error('Only admins can delete categories')
		}

		const projects = await ctx.db.query('projects').collect()
		const projectsUsingCategory = projects.filter((project) =>
			project.categoryIds.includes(args.id),
		)

		if (projectsUsingCategory.length > 0) {
			throw new Error(
				`Cannot delete category: ${projectsUsingCategory.length} projects are using it`,
			)
		}

		await ctx.db.delete(args.id)
	},
})
