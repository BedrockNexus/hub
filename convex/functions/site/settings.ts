import { v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { authComponent } from '../../auth'
import { r2, resolveCdnObjectUrl } from '../../lib/r2'
import {
	buildSiteImageR2ObjectKey,
	isSiteImageR2Key,
	type SiteImageKind,
} from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'

type SeoSettings = {
	siteDescription?: string
	ogImageR2Key?: string
}

type LegacySeoSettings = SeoSettings & {
	siteLogoR2Key?: string
	faviconR2Key?: string
}

type SocialSettings = {
	discord?: string
	youtube?: string
	instagram?: string
	bluesky?: string
	tiktok?: string
}

type FeatureSettings = {
	registrationEnabled?: boolean
	maintenanceMode?: boolean
}

const DEFAULT_SEO = {
	siteDescription:
		'Discover Minecraft Bedrock servers, projects, and community content.',
}

const DEFAULT_FEATURES = {
	registrationEnabled: true,
	maintenanceMode: false,
}

const R2_SITE_IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7
const MAX_SITE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_SITE_IMAGE_TYPES = new Set([
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
])
const MAX_SITE_DESCRIPTION_LENGTH = 160

async function resolveSiteImageUrl(key?: string) {
	if (!key) {
		return undefined
	}

	return resolveCdnObjectUrl(key, R2_SITE_IMAGE_URL_EXPIRES_IN)
}

async function validateSiteImageUpload(
	ctx: MutationCtx,
	args: {
		imageKind: SiteImageKind
		key: string
		label: string
	},
) {
	if (!isSiteImageR2Key(args.key, args.imageKind)) {
		throw new Error(`Invalid ${args.label.toLowerCase()} upload`)
	}

	const metadata = await r2.getMetadata(ctx, args.key)
	if (!metadata) {
		throw new Error(`${args.label} upload was not found`)
	}
	if (
		!metadata.contentType ||
		!ALLOWED_SITE_IMAGE_TYPES.has(metadata.contentType)
	) {
		throw new Error(`${args.label} must be a PNG, JPG, WebP, or GIF file`)
	}
	if (
		!metadata.size ||
		metadata.size <= 0 ||
		metadata.size > MAX_SITE_IMAGE_SIZE_BYTES
	) {
		throw new Error(`${args.label} must be 5MB or smaller`)
	}
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
	const user = await authComponent.getAuthUser(ctx)
	if (!user) {
		throw new Error('You must be logged in to manage settings')
	}
	if (user.role !== 'admin') {
		throw new Error('Only admins can manage settings')
	}

	return user
}

async function upsertSetting(
	ctx: MutationCtx,
	args: { key: string; value: unknown; description?: string; updatedBy?: string },
) {
	const existing = await ctx.db
		.query('siteSettings')
		.withIndex('by_key', (q) => q.eq('key', args.key))
		.unique()

	const now = Date.now()

	if (existing) {
		await ctx.db.patch(existing._id, {
			value: args.value,
			description: args.description ?? existing.description,
			updatedAt: now,
			updatedBy: args.updatedBy,
		})
		return existing._id
	}
	return await ctx.db.insert('siteSettings', {
		key: args.key,
		value: args.value,
		description: args.description,
		updatedAt: now,
		updatedBy: args.updatedBy,
	})
}

// =============================================================================
// SITE SETTINGS QUERIES
// =============================================================================

/**
 * Get a single setting by key
 */
export const get = query({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', args.key))
			.unique()
	},
})

/**
 * Get multiple settings by keys
 */
export const getMany = query({
	args: { keys: v.array(v.string()) },
	handler: async (ctx, args) => {
		const settings: Record<string, unknown> = {}

		for (const key of args.keys) {
			const setting = await ctx.db
				.query('siteSettings')
				.withIndex('by_key', (q) => q.eq('key', key))
				.unique()

			if (setting) {
				settings[key] = setting.value
			}
		}

		return settings
	},
})

/**
 * Get all settings (admin use)
 */
export const getAll = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx)

		return await ctx.db.query('siteSettings').collect()
	},
})

/**
 * Get admin-editable settings in one call.
 */
export const getAdmin = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx)

		const settings = await ctx.db.query('siteSettings').collect()
		const byKey = new Map(settings.map((setting) => [setting.key, setting]))
		const seo = byKey.get('seo')?.value as SeoSettings | undefined
		const socials = byKey.get('socials')?.value as SocialSettings | undefined
		const features = byKey.get('features')?.value as FeatureSettings | undefined

		return {
			seo: {
				siteDescription:
					seo?.siteDescription ?? DEFAULT_SEO.siteDescription,
				ogImageR2Key: seo?.ogImageR2Key,
				ogImageUrl: await resolveSiteImageUrl(seo?.ogImageR2Key),
			},
			socials: socials ?? {},
			features: {
				...DEFAULT_FEATURES,
				...features,
			},
		}
	},
})

// =============================================================================
// SITE SETTINGS MUTATIONS
// =============================================================================

/**
 * Set a single setting (upsert)
 */
export const set = mutation({
	args: {
		key: v.string(),
		value: v.any(),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await requireAdmin(ctx)

		return await upsertSetting(ctx, {
			key: args.key,
			value: args.value,
			description: args.description,
			updatedBy: user._id,
		})
	},
})

/**
 * Delete a setting
 */
export const remove = mutation({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		await requireAdmin(ctx)

		const existing = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', args.key))
			.unique()

		if (existing) {
			await ctx.db.delete(existing._id)
			return true
		}
		return false
	},
})

export const updateSeo = mutation({
	args: {
		siteDescription: v.string(),
		ogImageR2Key: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const user = await requireAdmin(ctx)
		const siteDescription = args.siteDescription.trim()

		if (
			!siteDescription ||
			siteDescription.length > MAX_SITE_DESCRIPTION_LENGTH
		) {
			throw new Error(
				`Site description must be between 1 and ${MAX_SITE_DESCRIPTION_LENGTH} characters`,
			)
		}
		const existing = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'seo'))
			.unique()
		const existingSeo = existing?.value as LegacySeoSettings | undefined
		const nextOgImageR2Key =
			args.ogImageR2Key === null ? undefined : args.ogImageR2Key

		if (
			nextOgImageR2Key &&
			nextOgImageR2Key !== existingSeo?.ogImageR2Key
		) {
			await validateSiteImageUpload(ctx, {
				imageKind: 'open-graph',
				key: nextOgImageR2Key,
				label: 'Open Graph image',
			})
		}

		const nextSeo: SeoSettings = {
			siteDescription,
			...(nextOgImageR2Key ? { ogImageR2Key: nextOgImageR2Key } : {}),
		}

		const settingId = await upsertSetting(ctx, {
			key: 'seo',
			value: nextSeo,
			description: 'Site SEO, title, metadata, and sharing image settings',
			updatedBy: user._id,
		})

		const replacedKeys = new Set([
			existingSeo?.siteLogoR2Key,
			existingSeo?.faviconR2Key,
			existingSeo?.ogImageR2Key !== nextOgImageR2Key
				? existingSeo?.ogImageR2Key
				: undefined,
		])
		for (const key of replacedKeys) {
			if (key) await r2.deleteObject(ctx, key)
		}

		return settingId
	},
})

export const updateSocials = mutation({
	args: {
		discord: v.optional(v.string()),
		youtube: v.optional(v.string()),
		instagram: v.optional(v.string()),
		bluesky: v.optional(v.string()),
		tiktok: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await requireAdmin(ctx)

		return await upsertSetting(ctx, {
			key: 'socials',
			value: args,
			description: 'Public social links used across site surfaces',
			updatedBy: user._id,
		})
	},
})

export const updateFeatures = mutation({
	args: {
		registrationEnabled: v.boolean(),
		maintenanceMode: v.boolean(),
	},
	handler: async (ctx, args) => {
		const user = await requireAdmin(ctx)

		return await upsertSetting(ctx, {
			key: 'features',
			value: args,
			description: 'Operational feature flags',
			updatedBy: user._id,
		})
	},
})

export const generateSiteImageUploadUrl = mutation({
	args: {
		fileName: v.string(),
		imageKind: v.literal('open-graph'),
	},
	handler: async (ctx, args) => {
		const user = await requireAdmin(ctx)
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		const key = buildSiteImageR2ObjectKey({
			imageKind: args.imageKind,
			fileName: args.fileName,
		})

		return r2.generateUploadUrl(key)
	},
})

// =============================================================================
// TYPED SETTING HELPERS
// =============================================================================

/**
 * Get site socials
 */
export const getSocials = query({
	args: {},
	handler: async (ctx) => {
		const setting = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'socials'))
			.unique()

		return (
			(setting?.value as {
				discord?: string
				youtube?: string
				instagram?: string
				bluesky?: string
				tiktok?: string
			}) ?? {}
		)
	},
})

/**
 * Get SEO settings
 */
export const getSeo = query({
	args: {},
	handler: async (ctx) => {
		const setting = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'seo'))
			.unique()

		const value = setting?.value as SeoSettings | undefined

		return {
			siteDescription:
				value?.siteDescription ??
				'Discover Minecraft Bedrock servers, projects, and community content.',
			ogImageR2Key: value?.ogImageR2Key,
			ogImageUrl: await resolveSiteImageUrl(value?.ogImageR2Key),
		}
	},
})

/**
 * Get feature flags
 */
export const getFeatures = query({
	args: {},
	handler: async (ctx) => {
		const setting = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'features'))
			.unique()

		return {
			...DEFAULT_FEATURES,
			...(setting?.value as FeatureSettings | undefined),
		}
	},
})

/**
 * Get homepage stats: active server count, total online players, published project count
 */
export const getStats = query({
	args: {},
	handler: async (ctx) => {
		const servers = await ctx.db
			.query('servers')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()

		const activeServerIds = new Set(servers.map((s) => s._id))
		const statuses = await ctx.db.query('serverStatus').collect()
		const onlinePlayers = statuses
			.filter((s) => activeServerIds.has(s.serverId))
			.reduce((sum, s) => sum + (s.online ? (s.playerCount ?? 0) : 0), 0)

		const projects = await ctx.db
			.query('projects')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()

		return {
			servers: servers.length,
			onlinePlayers,
			projects: projects.length,
		}
	},
})
