import { ConvexError, v } from 'convex/values'
import { query } from '../../_generated/server'
import { adminMutation, adminQuery } from '../../lib/functions'
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
			return await ctx.db
				.query('projectCategories')
				.order('asc')
				.collect()
		}

		return await ctx.db
			.query('projectCategories')
			.withIndex('by_active', (q) => q.eq('isActive', true))
			.collect()
	},
})

/**
 * List all project categories with usage counts for admin taxonomy management.
 */
export const listAdmin = adminQuery({
	args: {},
	handler: async (ctx) => {
		const categories = await ctx.db
			.query('projectCategories')
			.order('asc')
			.collect()
		if (categories.every((category) => category.projectCount !== undefined)) {
			return categories.map((category) => ({
				...category,
				projectCount: category.projectCount ?? 0,
				publishedProjectCount: category.publishedProjectCount ?? 0,
				contentCount: category.projectCount ?? 0,
			}))
		}

		// Counters not backfilled yet (projects/migrations:backfillCategoryCounts).
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
export const create = adminMutation({
	args: {
		projectType: projectType,
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const slug = generateSlug(args.name)

		const existing = await ctx.db
			.query('projectCategories')
			.withIndex('by_type_and_slug', (q) =>
				q.eq('projectType', args.projectType).eq('slug', slug),
			)
			.first()

		if (existing) {
			throw new ConvexError(
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
export const update = adminMutation({
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
		const { id, ...updates } = args
		const now = Date.now()

		if (updates.name) {
			const slug = generateSlug(updates.name)
			const category = await ctx.db.get(id)
			if (!category) throw new ConvexError('Category not found')

			const existing = await ctx.db
				.query('projectCategories')
				.withIndex('by_type_and_slug', (q) =>
					q.eq('projectType', category.projectType).eq('slug', slug),
				)
				.first()

			if (existing && existing._id !== id) {
				throw new ConvexError(
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
export const remove = adminMutation({
	args: { id: v.id('projectCategories') },
	handler: async (ctx, args) => {
		const category = await ctx.db.get(args.id)
		const usage =
			category?.projectCount ??
			// Counters not backfilled yet: fall back to scanning.
			(await ctx.db.query('projects').collect()).filter((project) =>
				project.categoryIds.includes(args.id),
			).length

		if (usage > 0) {
			throw new ConvexError(`Cannot delete category: ${usage} projects are using it`)
		}

		await ctx.db.delete(args.id)
	},
})
