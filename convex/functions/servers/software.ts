import { ConvexError, v } from 'convex/values'
import type { Doc } from '../../_generated/dataModel'
import { type QueryCtx, query } from '../../_generated/server'
import { isPublicServer } from '../../lib/contentVisibility'
import { countPublishedProjectsForSoftwareBatch } from '../../lib/plugins/aggregates'
import { statusOf, toCards } from './listing'
import { recordAdminAction } from '../../lib/audit'
import { assertOptionalHttpUrl } from '../../lib/contentValidation'
import { adminMutation, adminQuery } from '../../lib/functions'

/**
 * Server software (PocketMine-MP, PowerNukkitX, ...) as structured data.
 * Admins manage the list; server owners pick from it. It is declared, not
 * detected: a Bedrock status ping does not say what software answered it.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NAME_MAX = 50
const SLUG_MAX = 40
const DESCRIPTION_MAX = 300

const softwareFields = {
	name: v.string(),
	slug: v.string(),
	description: v.string(),
	websiteUrl: v.optional(v.string()),
	repositoryUrl: v.optional(v.string()),
	enabled: v.boolean(),
	sortOrder: v.number(),
}

function validateSoftware(fields: {
	name: string
	slug: string
	description: string
	websiteUrl?: string
	repositoryUrl?: string
}) {
	const name = fields.name.trim()
	if (name.length < 2 || name.length > NAME_MAX) {
		throw new ConvexError(`Name must be between 2 and ${NAME_MAX} characters`)
	}
	if (fields.slug.length > SLUG_MAX || !SLUG_PATTERN.test(fields.slug)) {
		throw new ConvexError(
			'Slug may only contain lowercase letters, numbers, and single hyphens',
		)
	}
	if (fields.description.trim().length > DESCRIPTION_MAX) {
		throw new ConvexError(
			`Description must be at most ${DESCRIPTION_MAX} characters`,
		)
	}
	assertOptionalHttpUrl('Website', fields.websiteUrl)
	assertOptionalHttpUrl('Repository link', fields.repositoryUrl)

	return {
		name,
		slug: fields.slug,
		description: fields.description.trim(),
		websiteUrl: fields.websiteUrl?.trim() || undefined,
		repositoryUrl: fields.repositoryUrl?.trim() || undefined,
	}
}

/** Software owners can choose from, in display order. */
export const listEnabled = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query('serverSoftware')
			.withIndex('by_enabled_and_sortOrder', (q) => q.eq('enabled', true))
			.collect()
	},
})

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const software = await ctx.db
			.query('serverSoftware')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique()
		return software?.enabled ? software : null
	},
})

/** Every software entry with how many servers declare it. */
export const listAdmin = adminQuery({
	args: {},
	handler: async (ctx) => {
		const software = await ctx.db.query('serverSoftware').collect()
		const rows = await Promise.all(
			software.map(async (item) => {
				const servers = await ctx.db
					.query('servers')
					.withIndex('by_softwareId', (q) => q.eq('softwareId', item._id))
					.collect()
				return { ...item, serverCount: servers.length }
			}),
		)
		return rows.sort(
			(a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
		)
	},
})

export const create = adminMutation({
	args: softwareFields,
	handler: async (ctx, args) => {
		const fields = validateSoftware(args)
		const existing = await ctx.db
			.query('serverSoftware')
			.withIndex('by_slug', (q) => q.eq('slug', fields.slug))
			.unique()
		if (existing) {
			throw new ConvexError('Server software with this slug already exists')
		}

		const now = Date.now()
		const id = await ctx.db.insert('serverSoftware', {
			...fields,
			enabled: args.enabled,
			sortOrder: args.sortOrder,
			createdAt: now,
			updatedAt: now,
		})
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'serverSoftware.create',
			targetType: 'serverSoftware',
			targetId: id,
			targetLabel: fields.name,
		})
		return id
	},
})

/**
 * The slug is the software's public URL and the key shared with the plugin
 * registry, so it cannot be changed after creation.
 */
export const update = adminMutation({
	args: {
		id: v.id('serverSoftware'),
		name: v.string(),
		description: v.string(),
		websiteUrl: v.optional(v.string()),
		repositoryUrl: v.optional(v.string()),
		enabled: v.boolean(),
		sortOrder: v.number(),
	},
	handler: async (ctx, args) => {
		const software = await ctx.db.get(args.id)
		if (!software) {
			throw new ConvexError('Server software not found')
		}
		const fields = validateSoftware({ ...args, slug: software.slug })

		await ctx.db.patch(args.id, {
			...fields,
			enabled: args.enabled,
			sortOrder: args.sortOrder,
			updatedAt: Date.now(),
		})
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'serverSoftware.update',
			targetType: 'serverSoftware',
			targetId: args.id,
			targetLabel: fields.name,
			changes: {
				name: fields.name === software.name ? undefined : fields.name,
				enabled:
					args.enabled === software.enabled ? undefined : args.enabled,
			},
		})
		return args.id
	},
})

/** Only unused software can be deleted; disable it to stop new selections. */
export const remove = adminMutation({
	args: { id: v.id('serverSoftware') },
	handler: async (ctx, args) => {
		const software = await ctx.db.get(args.id)
		if (!software) {
			throw new ConvexError('Server software not found')
		}
		const inUse = await ctx.db
			.query('servers')
			.withIndex('by_softwareId', (q) => q.eq('softwareId', args.id))
			.first()
		if (inUse) {
			throw new ConvexError(
				'Servers still use this software. Disable it instead of deleting it.',
			)
		}

		await ctx.db.delete(args.id)
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'serverSoftware.remove',
			targetType: 'serverSoftware',
			targetId: args.id,
			targetLabel: software.name,
		})
	},
})

// =============================================================================
// PUBLIC DIRECTORY (/software)
// =============================================================================

const DIRECTORY_LIMIT = 50
const SERVERS_SHOWN = 6

async function pluginsAreEnabled(ctx: QueryCtx) {
	const features = await ctx.db
		.query('siteSettings')
		.withIndex('by_key', (q) => q.eq('key', 'features'))
		.unique()
	return (
		(features?.value as { pluginsEnabled?: boolean } | undefined)
			?.pluginsEnabled === true
	)
}

async function statsFor(ctx: QueryCtx, software: Doc<'serverSoftware'>) {
	const stats = await ctx.db
		.query('serverSoftwareStats')
		.withIndex('by_softwareId', (q) => q.eq('softwareId', software._id))
		.unique()
	return {
		serverCount: stats?.serverCount ?? 0,
		onlineServers: stats?.onlineServers ?? 0,
		playersOnline: stats?.playersOnline ?? 0,
		versions: stats?.versions ?? [],
	}
}

function publicFields(software: Doc<'serverSoftware'>) {
	return {
		slug: software.slug,
		name: software.name,
		description: software.description,
		websiteUrl: software.websiteUrl,
		repositoryUrl: software.repositoryUrl,
		// Whether plugins can be published for it here.
		supportsPlugins: software.adapterId !== undefined,
	}
}

/**
 * Every enabled software with how many listed servers declare it and how many
 * players those servers have online. The totals are a few minutes old (see
 * functions/site/aggregates:refresh). Plugin counts are zero while the
 * Plugins feature is off.
 */
export const directory = query({
	args: {},
	handler: async (ctx) => {
		const [software, pluginsEnabled] = await Promise.all([
			ctx.db
				.query('serverSoftware')
				.withIndex('by_enabled_and_sortOrder', (q) =>
					q.eq('enabled', true),
				)
				.take(DIRECTORY_LIMIT),
			pluginsAreEnabled(ctx),
		])
		const [stats, pluginCounts] = await Promise.all([
			Promise.all(software.map((item) => statsFor(ctx, item))),
			pluginsEnabled
				? countPublishedProjectsForSoftwareBatch(
						ctx,
						software.map((item) => item._id),
					)
				: [],
		])
		return software.map((item, index) => ({
			...publicFields(item),
			serverCount: stats[index].serverCount,
			playersOnline: stats[index].playersOnline,
			pluginCount: pluginCounts[index] ?? 0,
			updatedAt: item.updatedAt,
		}))
	},
})

/** One software's page: its totals and the busiest servers declaring it. */
export const getDirectoryEntry = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const software = await ctx.db
			.query('serverSoftware')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug.trim()))
			.unique()
		if (!software?.enabled) {
			return null
		}
		const [stats, busiest] = await Promise.all([
			statsFor(ctx, software),
			ctx.db
				.query('serverStats')
				.withIndex('by_isPublic_and_softwareId_and_avgPlayers7d', (q) =>
					q.eq('isPublic', true).eq('softwareId', software._id),
				)
				.order('desc')
				.take(SERVERS_SHOWN),
		])
		const rows = (
			await Promise.all(
				busiest.map(async (row) => {
					const server = await ctx.db.get('servers', row.serverId)
					return server && isPublicServer(server)
						? {
								server,
								stats: row,
								status: await statusOf(ctx, server._id),
							}
						: null
				}),
			)
		).flatMap((row) => (row ? [row] : []))
		return {
			...publicFields(software),
			...stats,
			servers: await toCards(ctx, rows),
		}
	},
})
