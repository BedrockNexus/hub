import { v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List all active game versions (public — used in version pickers)
 */
export const listActive = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query('gameVersions')
			.withIndex('by_active', (q) => q.eq('isActive', true))
			.collect()
	},
})

/**
 * List all game versions including inactive (admin only)
 */
export const listAll = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user || user.role !== 'admin') {
			throw new Error('Not authorized')
		}
		return await ctx.db.query('gameVersions').order('desc').collect()
	},
})

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Add a new game version (admin only)
 */
export const create = mutation({
	args: {
		version: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user || user.role !== 'admin') {
			throw new Error('Not authorized')
		}

		const version = args.version.trim()
		if (!version) throw new Error('Version is required')

		// Prevent duplicates
		const existing = await ctx.db
			.query('gameVersions')
			.withIndex('by_version', (q) => q.eq('version', version))
			.unique()
		if (existing) throw new Error(`Version ${version} already exists`)

		return await ctx.db.insert('gameVersions', {
			version,
			isActive: true,
			createdAt: Date.now(),
		})
	},
})

/**
 * Toggle active status of a game version (admin only)
 */
export const toggleActive = mutation({
	args: {
		id: v.id('gameVersions'),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user || user.role !== 'admin') {
			throw new Error('Not authorized')
		}

		const gv = await ctx.db.get(args.id)
		if (!gv) throw new Error('Game version not found')

		await ctx.db.patch(args.id, { isActive: !gv.isActive })
	},
})

/**
 * Delete a game version (admin only)
 */
export const remove = mutation({
	args: {
		id: v.id('gameVersions'),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user || user.role !== 'admin') {
			throw new Error('Not authorized')
		}

		await ctx.db.delete(args.id)
	},
})
