import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'
import { syncCreatorListing } from '../../lib/creatorListings'
import {
	ensureProjectStats,
	ensureServerStats,
	syncProject,
	syncServer,
} from '../../lib/discovery'
import { isPublicRelease } from '../../lib/projectReleases'
import { supportedGameVersions } from '../projects/artifactValidation'

/**
 * Switches the plugin registry's pages on or off from the command line, for
 * deployments where no admin can sign in yet. Everywhere else, use the
 * Plugins toggle in the admin settings, which also records who changed it.
 *
 * Run: npx convex run functions/site/migrations:setPluginsEnabled '{"enabled":true}'
 */
export const setPluginsEnabled = internalMutation({
	args: { enabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'features'))
			.unique()
		const value = {
			...(existing?.value as Record<string, unknown> | undefined),
			pluginsEnabled: args.enabled,
		}
		if (existing) {
			await ctx.db.patch(existing._id, { value, updatedAt: Date.now() })
		} else {
			await ctx.db.insert('siteSettings', {
				key: 'features',
				value,
				description: 'Operational feature flags',
				updatedAt: Date.now(),
			})
		}
		return null
	},
})

const DISCOVERY_BATCH_SIZE = 50

/**
 * Fills in the listing fields kept by lib/discovery.ts for content that
 * existed before they did: public flags, types, publish and release dates,
 * exact save counts, supported Minecraft versions, and search text. New
 * writes maintain all of these themselves. Safe to re-run; it also repairs
 * drift and refreshes search text after categories are renamed.
 *
 * Run: npx convex run functions/site/migrations:backfillDiscovery
 */
export const backfillDiscovery = internalMutation({
	args: {
		source: v.optional(v.union(v.literal('servers'), v.literal('projects'))),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const source = args.source ?? 'servers'
		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: DISCOVERY_BATCH_SIZE,
		}
		let isDone: boolean
		let continueCursor: string

		if (source === 'servers') {
			const page = await ctx.db.query('servers').paginate(paginationOpts)
			for (const server of page.page) {
				const saves = await ctx.db
					.query('favourites')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.collect()
				const stats = await ensureServerStats(ctx, server._id)
				if (stats.favouriteCount !== saves.length) {
					await ctx.db.patch(stats._id, { favouriteCount: saves.length })
				}
				await syncServer(ctx, server)
			}
			;({ isDone, continueCursor } = page)
		} else {
			const page = await ctx.db.query('projects').paginate(paginationOpts)
			for (const project of page.page) {
				const saves = await ctx.db
					.query('favourites')
					.withIndex('by_project', (q) => q.eq('projectId', project._id))
					.collect()
				const stats = await ensureProjectStats(ctx, project._id)
				if (stats.favouriteCount !== saves.length) {
					await ctx.db.patch(stats._id, { favouriteCount: saves.length })
				}

				const releases = await ctx.db
					.query('projectVersions')
					.withIndex('by_project', (q) => q.eq('projectId', project._id))
					.order('desc')
					.collect()
				const versions = supportedGameVersions(releases.filter(isPublicRelease))
				if (versions.join('\n') !== (project.supportedGameVersions ?? []).join('\n')) {
					await ctx.db.patch(project._id, { supportedGameVersions: versions })
				}
				await syncProject(ctx, project)
			}
			;({ isDone, continueCursor } = page)
		}

		if (!isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillDiscovery,
				{ source, cursor: continueCursor },
			)
		} else if (source === 'servers') {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillDiscovery,
				{ source: 'projects', cursor: null },
			)
		}
		return null
	},
})

const CREATOR_LISTING_SOURCES = ['servers', 'projects', 'plugins'] as const
const CREATOR_LISTING_BATCH = 25

/**
 * Builds the search listings kept by lib/creatorListings.ts for creators and
 * organizations whose content existed before those listings did. New writes
 * maintain them. Safe to re-run; it also repairs drift.
 *
 * Run: npx convex run functions/site/migrations:backfillCreatorListings
 */
export const backfillCreatorListings = internalMutation({
	args: {
		source: v.optional(
			v.union(
				v.literal('servers'),
				v.literal('projects'),
				v.literal('plugins'),
			),
		),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const source = args.source ?? 'servers'
		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: CREATOR_LISTING_BATCH,
		}
		// `type:id` keys, so an owner of several items is rebuilt once.
		const owners = new Set<string>()
		let isDone: boolean
		let continueCursor: string

		if (source === 'servers') {
			const page = await ctx.db.query('servers').paginate(paginationOpts)
			for (const server of page.page) {
				owners.add(`user:${server.registeredBy}`)
				if (server.ownerType === 'organization') {
					owners.add(`organization:${server.ownerId}`)
				}
			}
			;({ isDone, continueCursor } = page)
		} else {
			const page = await ctx.db.query(source).paginate(paginationOpts)
			for (const item of page.page) {
				owners.add(`${item.ownerType}:${item.ownerId}`)
			}
			;({ isDone, continueCursor } = page)
		}

		for (const key of owners) {
			const separator = key.indexOf(':')
			await syncCreatorListing(
				ctx,
				key.slice(0, separator) as 'user' | 'organization',
				key.slice(separator + 1),
			)
		}

		const nextSource =
			CREATOR_LISTING_SOURCES[CREATOR_LISTING_SOURCES.indexOf(source) + 1]
		if (!isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillCreatorListings,
				{ source, cursor: continueCursor },
			)
		} else if (nextSource) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillCreatorListings,
				{ source: nextSource, cursor: null },
			)
		}
		return null
	},
})
