import { ConvexError, v } from 'convex/values'
import { internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	action,
	internalMutation,
	type MutationCtx,
	type QueryCtx,
	query,
} from '../../_generated/server'
import { validateImageObjectMetadata } from '../../lib/media'
import { getUserByTokenIdentifier, isStaff } from '../../lib/plugins/access'
import {
	getCdnObjectKey,
	getCdnObjectUrl,
	r2,
	syncCdnObjectMetadata,
} from '../../lib/r2'
import {
	buildSoftwareLogoR2ObjectKey,
	isSoftwareLogoR2Key,
} from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'
import { isPublicServer } from '../../lib/contentVisibility'
import { countPublishedProjectsForSoftwareBatch } from '../../lib/plugins/aggregates'
import { softwareIdsWithWorkflows } from '../../lib/plugins/workflowTemplates'
import { statusOf, toCards } from './listing'
import { recordAdminAction } from '../../lib/audit'
import { assertOptionalHttpUrl } from '../../lib/contentValidation'
import { adminMutation, adminQuery } from '../../lib/functions'

/**
 * Server software as structured data, managed by admins at
 * /admin/server-software. Server owners pick from it, and each plugin belongs
 * to one (through the publishing workflow it uses). It is declared, not
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
	assertOptionalHttpUrl('Source code link', fields.repositoryUrl)

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
 * The slug is the software's public URL (/software/[slug]) and its filter
 * value in listings. Servers, plugins and workflows refer to the software by
 * id, so changing it only changes those URLs.
 */
export const update = adminMutation({
	args: {
		id: v.id('serverSoftware'),
		...softwareFields,
	},
	handler: async (ctx, args) => {
		const software = await ctx.db.get(args.id)
		if (!software) {
			throw new ConvexError('Server software not found')
		}
		const fields = validateSoftware(args)
		if (fields.slug !== software.slug) {
			const taken = await ctx.db
				.query('serverSoftware')
				.withIndex('by_slug', (q) => q.eq('slug', fields.slug))
				.unique()
			if (taken) {
				throw new ConvexError(
					'Server software with this slug already exists',
				)
			}
		}

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
				slug: fields.slug === software.slug ? undefined : fields.slug,
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
		const [server, plugin, workflow] = await Promise.all([
			ctx.db
				.query('servers')
				.withIndex('by_softwareId', (q) => q.eq('softwareId', args.id))
				.first(),
			ctx.db
				.query('plugins')
				.withIndex('by_software_id', (q) => q.eq('softwareId', args.id))
				.first(),
			ctx.db
				.query('pluginWorkflowTemplates')
				.withIndex('by_softwareId', (q) => q.eq('softwareId', args.id))
				.first(),
		])
		if (server || plugin || workflow) {
			throw new ConvexError(
				'Servers, plugins or publishing workflows still use this software. Disable it instead of deleting it.',
			)
		}

		await ctx.db.delete(args.id)
		if (software.logoUrl) {
			await deleteLogo(ctx, software._id, software.logoUrl)
		}
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'serverSoftware.remove',
			targetType: 'serverSoftware',
			targetId: args.id,
			targetLabel: software.name,
		})
	},
})

// =============================================================================
// LOGOS
// =============================================================================

// The browser resizes logos to 256px before uploading; this is generous.
const MAX_LOGO_SIZE = 1024 * 1024

async function deleteLogo(
	ctx: MutationCtx,
	softwareId: Id<'serverSoftware'>,
	logoUrl: string,
) {
	const key = getCdnObjectKey(logoUrl)
	if (key && isSoftwareLogoR2Key(key, softwareId)) {
		await r2.deleteObject(ctx, key)
	}
}

export const generateLogoUploadUrl = adminMutation({
	args: { id: v.id('serverSoftware'), fileName: v.string() },
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			ctx.admin._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		if (!(await ctx.db.get(args.id))) {
			throw new ConvexError('Server software not found')
		}
		return await r2.generateUploadUrl(
			buildSoftwareLogoR2ObjectKey({
				softwareId: args.id,
				assetId: crypto.randomUUID(),
				fileName: args.fileName,
			}),
		)
	},
})

/** Checks an uploaded logo and saves it, replacing the old one. */
export const confirmLogoUpload = action({
	args: { id: v.id('serverSoftware'), key: v.string() },
	returns: v.string(),
	handler: async (ctx, args): Promise<string> => {
		const identity = await ctx.auth.getUserIdentity()
		if (!identity) {
			throw new ConvexError('You must be signed in')
		}
		if (!isSoftwareLogoR2Key(args.key, args.id)) {
			throw new ConvexError('Upload the logo before saving it')
		}
		const url = getCdnObjectUrl(args.key)
		if (!url) {
			throw new Error('R2_CDN_PUBLIC_URL is not configured')
		}
		await syncCdnObjectMetadata(ctx, args.key)
		await validateImageObjectMetadata(ctx, args.key, MAX_LOGO_SIZE)
		await ctx.runMutation(internal.functions.servers.software.setLogo, {
			tokenIdentifier: identity.tokenIdentifier,
			id: args.id,
			logoUrl: url,
		})
		return url
	},
})

export const setLogo = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		id: v.id('serverSoftware'),
		logoUrl: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		if (!isStaff(user)) {
			throw new ConvexError('Admin role required')
		}
		const software = await ctx.db.get(args.id)
		if (!software) {
			throw new ConvexError('Server software not found')
		}
		await ctx.db.patch(software._id, {
			logoUrl: args.logoUrl,
			updatedAt: Date.now(),
		})
		if (software.logoUrl && software.logoUrl !== args.logoUrl) {
			await deleteLogo(ctx, software._id, software.logoUrl)
		}
		await recordAdminAction(ctx, user._id, {
			action: 'serverSoftware.logo',
			targetType: 'serverSoftware',
			targetId: software._id,
			targetLabel: software.name,
		})
		return null
	},
})

export const removeLogo = adminMutation({
	args: { id: v.id('serverSoftware') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const software = await ctx.db.get(args.id)
		if (!software?.logoUrl) {
			return null
		}
		await ctx.db.patch(software._id, {
			logoUrl: undefined,
			updatedAt: Date.now(),
		})
		await deleteLogo(ctx, software._id, software.logoUrl)
		return null
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

function publicFields(
	software: Doc<'serverSoftware'>,
	withWorkflows: ReadonlySet<string>,
) {
	return {
		slug: software.slug,
		name: software.name,
		description: software.description,
		logoUrl: software.logoUrl,
		websiteUrl: software.websiteUrl,
		repositoryUrl: software.repositoryUrl,
		// Plugins can be published for it once it has a publishing workflow.
		supportsPlugins: withWorkflows.has(software._id),
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
		const [stats, pluginCounts, withWorkflows] = await Promise.all([
			Promise.all(software.map((item) => statsFor(ctx, item))),
			pluginsEnabled
				? countPublishedProjectsForSoftwareBatch(
						ctx,
						software.map((item) => item._id),
					)
				: [],
			softwareIdsWithWorkflows(ctx),
		])
		return software.map((item, index) => ({
			...publicFields(item, withWorkflows),
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
		const [stats, busiest, withWorkflows] = await Promise.all([
			statsFor(ctx, software),
			ctx.db
				.query('serverStats')
				.withIndex('by_isPublic_and_softwareId_and_avgPlayers7d', (q) =>
					q.eq('isPublic', true).eq('softwareId', software._id),
				)
				.order('desc')
				.take(SERVERS_SHOWN),
			softwareIdsWithWorkflows(ctx),
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
			...publicFields(software, withWorkflows),
			...stats,
			servers: await toCards(ctx, rows),
		}
	},
})
