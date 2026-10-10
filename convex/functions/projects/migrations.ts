import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'

const DEFAULT_PROJECT_CATEGORIES = {
	addon: ['Gameplay', 'Utility', 'Mobs', 'Items', 'Blocks', 'Scripts'],
	resource_pack: ['Vanilla+', 'PvP', 'UI', 'Realistic', 'Stylized', 'Audio'],
} as const

function categorySlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

/**
 * Run once before removing the legacy `texture_pack` validator from the schema.
 * This is idempotent and safe to run again after a partial deployment.
 */
export const migrateTexturePacks = internalMutation({
	args: {},
	handler: async (ctx) => {
		const projects = await ctx.db
			.query('projects')
			.filter((q) => q.eq(q.field('type'), 'texture_pack'))
			.collect()
		const categories = await ctx.db
			.query('projectCategories')
			.filter((q) => q.eq(q.field('projectType'), 'texture_pack'))
			.collect()
		const uploads = await ctx.db
			.query('projectArtifactUploads')
			.filter((q) => q.eq(q.field('projectType'), 'texture_pack'))
			.collect()

		for (const project of projects) {
			await ctx.db.patch(project._id, { type: 'resource_pack' })
		}
		for (const category of categories) {
			await ctx.db.patch(category._id, { projectType: 'resource_pack' })
		}
		for (const upload of uploads) {
			await ctx.db.patch(upload._id, { projectType: 'resource_pack' })
		}

		return {
			projects: projects.length,
			categories: categories.length,
			uploads: uploads.length,
		}
	},
})

/** Adds only missing defaults and never modifies existing category records. */
export const seedDefaultProjectCategories = internalMutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db.query('projectCategories').collect()
		const existingKeys = new Set(
			existing.map((category) =>
				`${category.projectType}:${category.slug}`,
			),
		)
		const now = Date.now()
		let created = 0

		for (const [projectType, names] of Object.entries(
			DEFAULT_PROJECT_CATEGORIES,
		)) {
			for (const [index, name] of names.entries()) {
				const slug = categorySlug(name)
				const key = `${projectType}:${slug}`
				if (existingKeys.has(key)) continue

				await ctx.db.insert('projectCategories', {
					projectType: projectType as keyof typeof DEFAULT_PROJECT_CATEGORIES,
					name,
					slug,
					sortOrder: index,
					isActive: true,
					createdAt: now,
					updatedAt: now,
				})
				existingKeys.add(key)
				created += 1
			}
		}

		return { created }
	},
})

const countEntry = v.object({
	categoryId: v.string(),
	total: v.number(),
	published: v.number(),
})

/**
 * Writes exact category usage counters (see lib/categoryCounts.ts). Counts
 * accumulate across pages and are written to every category at the end, so
 * re-running it corrects any drift.
 *
 * Run: npx convex run functions/projects/migrations:backfillCategoryCounts
 */
export const backfillCategoryCounts = internalMutation({
	args: {
		cursor: v.optional(v.union(v.string(), v.null())),
		counts: v.optional(v.array(countEntry)),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const counts = new Map(
			(args.counts ?? []).map((entry) => [entry.categoryId, entry]),
		)
		const page = await ctx.db
			.query('projects')
			.paginate({ cursor: args.cursor ?? null, numItems: 200 })
		for (const doc of page.page) {
			for (const categoryId of new Set<string>(doc.categoryIds)) {
				const entry = counts.get(categoryId) ?? { categoryId, total: 0, published: 0 }
				entry.total += 1
				if (doc.status === 'published') entry.published += 1
				counts.set(categoryId, entry)
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.projects.migrations.backfillCategoryCounts,
				{ cursor: page.continueCursor, counts: [...counts.values()] },
			)
			return null
		}

		for (const category of await ctx.db.query('projectCategories').collect()) {
			const entry = counts.get(category._id)
			await ctx.db.patch(category._id, {
				projectCount: entry?.total ?? 0,
				publishedProjectCount: entry?.published ?? 0,
			})
		}
		return null
	},
})
