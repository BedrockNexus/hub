import { v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	moderationStatus as projectModerationStatus,
	projectMetadata,
	projectType,
} from '../../schemas/projects'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { isPublicProject } from '../../lib/contentVisibility'
import { validateEntityImageUpload } from '../../lib/media'
import { r2, resolveCdnObjectUrl, uploadsR2 } from '../../lib/r2'
import { enforceRateLimit } from '../../lib/rateLimits'
import {
	normalizeProjectType,
	type StoredProjectType,
} from '../../../lib/project-artifacts'

// =============================================================================
// TYPES
// =============================================================================

type SortOption = 'newest' | 'name' | 'rating' | 'downloads'

// Max items to scan per query — prevents unbounded full-table reads.
// Sorting by downloads/rating requires a full pre-filter scan; denormalizing
// those fields into the projects table would enable proper cursor pagination.
const MAX_SCAN = 1000
const R2_IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

// =============================================================================
// HELPERS
// =============================================================================

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

function getUtcDayKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 10)
}

function getUtcMonthKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 7)
}

async function resolveProjectIconUrl(
	project: Doc<'projects'>,
): Promise<string | undefined> {
	if (project.iconR2Key) {
		return resolveCdnObjectUrl(project.iconR2Key, R2_IMAGE_URL_EXPIRES_IN)
	}

	return undefined
}

async function assertCategoriesMatchProjectType(
	ctx: MutationCtx,
	categoryIds: Id<'projectCategories'>[],
	type: StoredProjectType,
) {
	const categories = await Promise.all(categoryIds.map((id) => ctx.db.get(id)))
	const normalizedType = normalizeProjectType(type)

	if (
		categories.some(
			(category) =>
				!category ||
				normalizeProjectType(category.projectType) !== normalizedType,
		)
	) {
		throw new Error('Every category must match the selected project type')
	}
}

function assertMetadataMatchesProjectType(
	type: StoredProjectType,
	metadata:
		| {
				type: string
				dependencies?: Array<{ name: string; url?: string }>
				estimatedPlaytimeMinutes?: number
				contentTypes?: string[]
		  }
		| undefined,
) {
	if (metadata && metadata.type !== normalizeProjectType(type)) {
		throw new Error('Project details must match the selected project type')
	}
	if (!metadata) return
	if (metadata.dependencies) {
		if (metadata.dependencies.length > 20) {
			throw new Error('A project can have at most 20 dependencies')
		}
		for (const dependency of metadata.dependencies) {
			if (!dependency.name.trim() || dependency.name.length > 80) {
				throw new Error('Dependency names must be between 1 and 80 characters')
			}
			if (dependency.url) {
				let url: URL
				try {
					url = new URL(dependency.url)
				} catch {
					throw new Error('Dependency links must be valid URLs')
				}
				if (!['http:', 'https:'].includes(url.protocol)) {
					throw new Error('Dependency links must use HTTP or HTTPS')
				}
			}
		}
	}
	if (
		metadata.estimatedPlaytimeMinutes !== undefined &&
		(!Number.isInteger(metadata.estimatedPlaytimeMinutes) ||
			metadata.estimatedPlaytimeMinutes < 1 ||
			metadata.estimatedPlaytimeMinutes > 10_000)
	) {
		throw new Error('Estimated playtime must be between 1 and 10,000 minutes')
	}
	if (metadata.type === 'resource_pack' && !metadata.contentTypes?.length) {
		throw new Error('Select at least one resource pack content area')
	}
}

async function resolveProjectBannerUrl(
	project: Doc<'projects'>,
): Promise<string | undefined> {
	if (project.bannerR2Key) {
		return resolveCdnObjectUrl(project.bannerR2Key, R2_IMAGE_URL_EXPIRES_IN)
	}

	return undefined
}

function getUserDisplayName(user: unknown): string | undefined {
	const record = user as Record<string, unknown> | null
	return (
		(record?.displayUsername as string | undefined) ??
		(record?.username as string | undefined) ??
		(record?.email as string | undefined)
	)
}

async function resolveProjectOwnerLabels(
	ctx: QueryCtx,
	project: Doc<'projects'>,
): Promise<{ ownerName: string; createdByName: string }> {
	let ownerName = 'Unknown owner'

	if (project.ownerType === 'organization') {
		const organization = (await ctx.runQuery(
			components.betterAuth.adapter.findOne,
			{
				model: 'organization',
				where: [{ field: '_id', value: project.ownerId }],
			},
		)) as { name?: string } | null

		ownerName = organization?.name ?? 'Unknown organization'
	} else {
		const owner = await authComponent.getAnyUserById(ctx, project.ownerId)
		ownerName = getUserDisplayName(owner) ?? 'Unknown user'
	}

	const createdBy = await authComponent.getAnyUserById(ctx, project.createdBy)

	return {
		ownerName,
		createdByName: getUserDisplayName(createdBy) ?? 'Unknown user',
	}
}

async function getProjectCategoryMap(
	ctx: QueryCtx,
	projects: Doc<'projects'>[],
): Promise<Map<Id<'projectCategories'>, Doc<'projectCategories'>>> {
	const categoryIds = new Set<Id<'projectCategories'>>()
	for (const project of projects) {
		for (const categoryId of project.categoryIds) {
			categoryIds.add(categoryId)
		}
	}

	const categories = await Promise.all(
		Array.from(categoryIds).map((id) => ctx.db.get(id)),
	)

	return new Map(
		categories
			.filter(
				(category): category is Doc<'projectCategories'> =>
					category !== null,
			)
			.map((category) => [category._id, category]),
	)
}

async function getProjectStatsMap(ctx: QueryCtx, projects: Doc<'projects'>[]) {
	const stats = await Promise.all(
		projects.map((project) =>
			ctx.db
				.query('projectStats')
				.withIndex('by_project', (q) => q.eq('projectId', project._id))
				.first(),
		),
	)

	return new Map(
		stats
			.filter((item): item is NonNullable<typeof item> => item !== null)
			.map((item) => [item.projectId, item]),
	)
}

async function enrichProjectListItem(ctx: QueryCtx, item: Doc<'projects'>) {
	const categories = await Promise.all(
		item.categoryIds.map((id) => ctx.db.get(id)),
	)

	const stats = await ctx.db
		.query('projectStats')
		.withIndex('by_project', (q) => q.eq('projectId', item._id))
		.first()

	const iconUrl = await resolveProjectIconUrl(item)

	return {
		...item,
		iconUrl,
		categories: categories.filter(Boolean),
		averageRating: stats?.averageRating ?? 0,
		reviewCount: stats?.reviewCount ?? 0,
		totalDownloads: stats?.totalDownloads ?? 0,
	}
}

async function projectHasVersion(
	ctx: QueryCtx | MutationCtx,
	projectId: Id<'projects'>,
) {
	const versions = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.collect()

	return versions.some(
		(version) =>
			version.validationStatus === undefined ||
			version.validationStatus === 'valid',
	)
}

async function assertProjectHasVersion(
	ctx: QueryCtx | MutationCtx,
	projectId: Id<'projects'>,
) {
	if (!(await projectHasVersion(ctx, projectId))) {
		throw new Error(
			'Upload and validate at least one version file before this project can be submitted or published',
		)
	}
}

async function deleteR2ObjectIfPresent(ctx: MutationCtx, key?: string) {
	if (key) {
		await r2.deleteObject(ctx, key)
	}
}

async function deleteProjectFiles(ctx: MutationCtx, project: Doc<'projects'>) {
	await deleteR2ObjectIfPresent(ctx, project.iconR2Key)
	await deleteR2ObjectIfPresent(ctx, project.bannerR2Key)

	const galleryItems = await ctx.db
		.query('projectGallery')
		.withIndex('by_project', (q) => q.eq('projectId', project._id))
		.collect()
	for (const item of galleryItems) {
		await r2.deleteObject(ctx, item.r2Key)
		await ctx.db.delete(item._id)
	}

	const versions = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', project._id))
		.collect()
	for (const version of versions) {
		if (version.uploadR2Key) {
			await uploadsR2.deleteObject(ctx, version.uploadR2Key)
		}
		if (version.cdnR2Key) {
			await r2.deleteObject(ctx, version.cdnR2Key)
		} else if (!version.uploadR2Key) {
			await r2.deleteObject(ctx, version.r2Key)
		}
		await ctx.db.delete(version._id)
	}
}

async function deleteProjectRelatedRows(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
) {
	const stats = await ctx.db
		.query('projectStats')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.collect()
	for (const item of stats) {
		await ctx.db.delete(item._id)
	}

	const reviews = await ctx.db
		.query('projectReviews')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
		.collect()
	for (const item of reviews) {
		await ctx.db.delete(item._id)
	}
}

async function enrichProjectDetail(ctx: QueryCtx, item: Doc<'projects'>) {
	const now = Date.now()
	const dayKey = getUtcDayKey(now)
	const monthKey = getUtcMonthKey(now)

	const categories = await Promise.all(
		item.categoryIds.map((id) => ctx.db.get(id)),
	)

	const stats = await ctx.db
		.query('projectStats')
		.withIndex('by_project', (q) => q.eq('projectId', item._id))
		.first()

	const totalDownloadsToday =
		stats && stats.dailyKey === dayKey
			? (stats.totalDownloadsToday ?? 0)
			: 0
	const totalDownloadsThisMonth =
		stats && stats.monthlyKey === monthKey
			? (stats.totalDownloadsThisMonth ?? 0)
			: 0

	const iconUrl = await resolveProjectIconUrl(item)
	const bannerUrl = await resolveProjectBannerUrl(item)

	const latestVersion = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', item._id))
		.order('desc')
		.first()

	let ownerData:
		| {
				type: 'user'
				username?: string
				displayUsername?: string
				image?: string
		  }
		| {
				type: 'organization'
				name: string
				slug: string
				logo?: string | null
		  }
		| null = null

	if (item.ownerType === 'organization') {
		const org = (await ctx.runQuery(
			components.betterAuth.adapter.findOne,
			{
				model: 'organization',
				where: [{ field: '_id', value: item.ownerId }],
			},
		)) as {
			_id: string
			name: string
			slug: string
			logo?: string | null
		} | null

		if (org) {
			ownerData = {
				type: 'organization',
				name: org.name,
				slug: org.slug,
				logo: org.logo,
			}
		}
	} else {
		const owner = await authComponent.getAnyUserById(ctx, item.createdBy)
		ownerData = owner
			? {
					type: 'user',
					username: (owner as Record<string, unknown>).username as
						| string
						| undefined,
					displayUsername: (owner as Record<string, unknown>)
						.displayUsername as string | undefined,
					image: (owner as Record<string, unknown>).image as
						| string
						| undefined,
				}
			: null
	}

	return {
		...item,
		iconUrl,
		bannerUrl,
		categories: categories.filter(Boolean),
		totalDownloads: stats?.totalDownloads ?? 0,
		totalDownloadsToday,
		totalDownloadsThisMonth,
		averageRating: stats?.averageRating ?? 0,
		reviewCount: stats?.reviewCount ?? 0,
		latestVersion: latestVersion
			? {
					version: latestVersion.version,
					createdAt: latestVersion.createdAt,
					gameVersions: latestVersion.gameVersions,
					fileSize: latestVersion.fileSize,
					skinModel: latestVersion.skinModel,
					validationReport: latestVersion.validationReport,
				}
			: null,
		owner: ownerData,
	}
}

/**
 * Returns true if the given user is allowed to modify the project.
 * - User-owned: user must be the owner.
 * - Org-owned: user must be a member of the organization.
 */
async function canModifyProject(
	ctx: MutationCtx | QueryCtx,
	project: { ownerType: 'user' | 'organization'; ownerId: string },
	userId: string,
): Promise<boolean> {
	if (project.ownerType === 'user') {
		return project.ownerId === userId
	}

	const member = (await ctx.runQuery(
		components.betterAuth.adapter.findOne,
		{
			model: 'member',
			where: [
				{ field: 'organizationId', value: project.ownerId },
				{ field: 'userId', value: userId },
			],
		},
	)) as { id?: string } | null

	return !!member
}

async function getUserOrganizationIds(
	ctx: MutationCtx | QueryCtx,
	userId: string,
): Promise<string[]> {
	const membersResult = (await ctx.runQuery(
		components.betterAuth.adapter.findMany,
		{
			model: 'member',
			where: [{ field: 'userId', value: userId }],
			paginationOpts: { cursor: null, numItems: 100 },
		},
	)) as { page: Array<{ organizationId: string }> }

	return (membersResult.page ?? []).map((member) => member.organizationId)
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Advanced project search with filtering and sorting
 */
export const searchAdvanced = query({
	args: {
		query: v.optional(v.string()),
		type: v.optional(projectType),
		categoryIds: v.optional(v.array(v.id('projectCategories'))),
		experimentalFeaturesRequired: v.optional(v.boolean()),
		mapGameMode: v.optional(
			v.union(
				v.literal('survival'),
				v.literal('creative'),
				v.literal('adventure'),
				v.literal('mixed'),
			),
		),
		multiplayerSupport: v.optional(v.boolean()),
		resourcePackResolution: v.optional(
			v.union(
				v.literal('8x'),
				v.literal('16x'),
				v.literal('32x'),
				v.literal('64x'),
				v.literal('128x'),
				v.literal('256x'),
				v.literal('512x'),
				v.literal('custom'),
			),
		),
		resourcePackContentType: v.optional(
			v.union(
				v.literal('textures'),
				v.literal('ui'),
				v.literal('sounds'),
				v.literal('shaders'),
			),
		),
		skinCharacterCategory: v.optional(
			v.union(
				v.literal('original'),
				v.literal('games'),
				v.literal('anime'),
				v.literal('movies_tv'),
				v.literal('historical'),
				v.literal('other'),
			),
		),
		sort: v.optional(
			v.union(
				v.literal('newest'),
				v.literal('name'),
				v.literal('rating'),
				v.literal('downloads'),
			),
		),
		limit: v.optional(v.number()),
		cursor: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 24
		const offset = args.cursor ?? 0
		const sort: SortOption = args.sort ?? 'downloads'

		let items: Doc<'projects'>[]
		const queryText = args.query?.trim()
		const typeFilter = args.type

		if (queryText) {
			items = await ctx.db
				.query('projects')
				.withSearchIndex('search_projects', (q) => {
					const search = q.search('name', queryText).eq('status', 'published')
					return typeFilter ? search.eq('type', typeFilter) : search
				})
				.take(MAX_SCAN)
		} else if (typeFilter) {
			items = await ctx.db
				.query('projects')
				.withIndex('by_type_status', (q) =>
					q.eq('type', typeFilter).eq('status', 'published'),
				)
				.take(MAX_SCAN)
		} else {
			items = await ctx.db
				.query('projects')
				.withIndex('by_status', (q) => q.eq('status', 'published'))
				.take(MAX_SCAN)
		}

		// Filter by categories
		const categoryIds = args.categoryIds ?? []
		if (categoryIds.length > 0) {
			items = items.filter((a) =>
				categoryIds.some((catId) => a.categoryIds.includes(catId)),
			)
		}

		items = items.filter((project) => {
			const metadata = project.metadata
			if (
				args.experimentalFeaturesRequired !== undefined &&
				(metadata?.type !== 'addon' ||
					metadata.experimentalFeaturesRequired !==
						args.experimentalFeaturesRequired)
			) {
				return false
			}
			if (
				args.mapGameMode &&
				(metadata?.type !== 'map' || metadata.gameMode !== args.mapGameMode)
			) {
				return false
			}
			if (
				args.multiplayerSupport !== undefined &&
				(metadata?.type !== 'map' ||
					metadata.multiplayerSupport !== args.multiplayerSupport)
			) {
				return false
			}
			if (
				args.resourcePackResolution &&
				(metadata?.type !== 'resource_pack' ||
					metadata.resolution !== args.resourcePackResolution)
			) {
				return false
			}
			if (
				args.resourcePackContentType &&
				(metadata?.type !== 'resource_pack' ||
					!metadata.contentTypes.includes(args.resourcePackContentType))
			) {
				return false
			}
			if (
				args.skinCharacterCategory &&
				(metadata?.type !== 'skin' ||
					metadata.characterCategory !== args.skinCharacterCategory)
			) {
				return false
			}
			return true
		})

		items = items.filter(isPublicProject)

		const needsStatsForSort = sort === 'rating' || sort === 'downloads'
		let statsMap = needsStatsForSort
			? await getProjectStatsMap(ctx, items)
			: new Map()

		// Sort
		switch (sort) {
			case 'newest':
				items.sort((a, b) => b._creationTime - a._creationTime)
				break
			case 'name':
				items.sort((a, b) => a.name.localeCompare(b.name))
				break
			case 'rating':
				items.sort(
					(a, b) =>
						(statsMap.get(b._id)?.averageRating ?? 0) -
						(statsMap.get(a._id)?.averageRating ?? 0),
				)
				break
			case 'downloads':
				items.sort(
					(a, b) =>
						(statsMap.get(b._id)?.totalDownloads ?? 0) -
						(statsMap.get(a._id)?.totalDownloads ?? 0),
				)
				break
		}

		// Pagination
		const totalCount = items.length
		const paginatedItems = items.slice(offset, offset + limit)
		if (!needsStatsForSort) {
			statsMap = await getProjectStatsMap(ctx, paginatedItems)
		}
		const categoryMap = await getProjectCategoryMap(ctx, paginatedItems)

		// Enrich
		const enrichedItems = await Promise.all(
			paginatedItems.map(async (item) => {
				const stats = statsMap.get(item._id)

				const iconUrl = await resolveProjectIconUrl(item)

				return {
					...item,
					iconUrl,
					categories: item.categoryIds
						.map((id) => categoryMap.get(id))
						.filter(
							(category): category is Doc<'projectCategories'> =>
								category !== undefined,
						),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
					totalDownloads: stats?.totalDownloads ?? 0,
				}
			}),
		)

		return {
			items: enrichedItems,
			totalCount,
			hasMore: offset + limit < totalCount,
			nextCursor: offset + limit < totalCount ? offset + limit : null,
		}
	},
})

/**
 * List all published projects
 */
export const list = query({
	args: {
		type: v.optional(projectType),
		categoryId: v.optional(v.id('projectCategories')),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 20
		const typeFilter = args.type

		let items: Doc<'projects'>[]

		if (typeFilter) {
			items = await ctx.db
				.query('projects')
				.withIndex('by_type_status', (q) =>
					q.eq('type', typeFilter).eq('status', 'published'),
				)
				.take(MAX_SCAN)
		} else {
			items = await ctx.db
				.query('projects')
				.withIndex('by_status', (q) => q.eq('status', 'published'))
				.take(MAX_SCAN)
		}

		const categoryId = args.categoryId
		if (categoryId !== undefined) {
			items = items.filter((a) => a.categoryIds.includes(categoryId))
		}
		items = items.filter(isPublicProject)

		const enriched = await Promise.all(
			items.slice(0, limit).map(async (item) => {
				const categories = await Promise.all(
					item.categoryIds.map((id) => ctx.db.get(id)),
				)

				const stats = await ctx.db
					.query('projectStats')
					.withIndex('by_project', (q) =>
						q.eq('projectId', item._id),
					)
					.first()

				const iconUrl = await resolveProjectIconUrl(item)

				return {
					...item,
					iconUrl,
					categories: categories.filter(Boolean),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
					totalDownloads: stats?.totalDownloads ?? 0,
				}
			}),
		)

		return {
			items: enriched,
			hasMore: items.length > limit,
		}
	},
})

export const getPublishedBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const item = await ctx.db
			.query('projects')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.first()

		if (!item || !isPublicProject(item)) {
			return null
		}

		return enrichProjectDetail(ctx, item)
	},
})

/**
 * Get a single project by slug
 */
export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const now = Date.now()
		const dayKey = getUtcDayKey(now)
		const monthKey = getUtcMonthKey(now)

		const item = await ctx.db
			.query('projects')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.first()

		if (!item) {
			return null
		}

		const user = await authComponent.getAuthUser(ctx)
		if (
			user.role !== 'admin' &&
			!(await canModifyProject(ctx, item, user._id))
		) {
			return null
		}

		const categories = await Promise.all(
			item.categoryIds.map((id) => ctx.db.get(id)),
		)

		const stats = await ctx.db
			.query('projectStats')
			.withIndex('by_project', (q) => q.eq('projectId', item._id))
			.first()

		const totalDownloadsToday =
			stats && stats.dailyKey === dayKey
				? (stats.totalDownloadsToday ?? 0)
				: 0
		const totalDownloadsThisMonth =
			stats && stats.monthlyKey === monthKey
				? (stats.totalDownloadsThisMonth ?? 0)
				: 0

		const iconUrl = await resolveProjectIconUrl(item)

		// Get latest version
		const latestVersion = await ctx.db
			.query('projectVersions')
			.withIndex('by_project', (q) => q.eq('projectId', item._id))
			.order('desc')
			.first()

		// Get owner info
		let ownerData:
			| {
					type: 'user'
					username?: string
					displayUsername?: string
					image?: string
			  }
			| {
					type: 'organization'
					name: string
					slug: string
					logo?: string | null
			  }
			| null = null

		if (item.ownerType === 'organization') {
			const org = (await ctx.runQuery(
				components.betterAuth.adapter.findOne,
				{
					model: 'organization',
					where: [{ field: '_id', value: item.ownerId }],
				},
			)) as {
				_id: string
				name: string
				slug: string
				logo?: string | null
			} | null

			if (org) {
				ownerData = {
					type: 'organization',
					name: org.name,
					slug: org.slug,
					logo: org.logo,
				}
			}
		} else {
			const owner = await authComponent.getAnyUserById(
				ctx,
				item.createdBy,
			)
			ownerData = owner
				? {
						type: 'user',
						username: (owner as Record<string, unknown>).username as
							| string
							| undefined,
						displayUsername: (owner as Record<string, unknown>)
							.displayUsername as string | undefined,
						image: (owner as Record<string, unknown>).image as
							| string
							| undefined,
					}
				: null
		}

		return {
			...item,
			iconUrl,
			bannerUrl: await resolveProjectBannerUrl(item),
			categories: categories.filter(Boolean),
			totalDownloads: stats?.totalDownloads ?? 0,
			totalDownloadsToday,
			totalDownloadsThisMonth,
			averageRating: stats?.averageRating ?? 0,
			reviewCount: stats?.reviewCount ?? 0,
			latestVersion: latestVersion
				? {
						version: latestVersion.version,
						createdAt: latestVersion.createdAt,
						gameVersions: latestVersion.gameVersions,
					}
				: null,
			owner: ownerData,
		}
	},
})

/**
 * List current user's projects (for dashboard)
 */
export const listMyContent = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) return []

		const byOwner = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', 'user').eq('ownerId', user._id),
			)
			.collect()

		// Also find projects created by this user with missing ownerId
		const byCreator = await ctx.db
			.query('projects')
			.withIndex('by_created_by', (q) => q.eq('createdBy', user._id))
			.collect()

		const organizationIds = await getUserOrganizationIds(ctx, user._id)
		const byOrganizations = (
			await Promise.all(
				organizationIds.map((organizationId) =>
					ctx.db
						.query('projects')
						.withIndex('by_owner', (q) =>
							q
								.eq('ownerType', 'organization')
								.eq('ownerId', organizationId),
						)
						.collect(),
				),
			)
		).flat()

		const seen = new Set<Id<'projects'>>()
		const items: Doc<'projects'>[] = []
		for (const item of [...byOwner, ...byOrganizations, ...byCreator]) {
			if (seen.has(item._id)) {
				continue
			}
			seen.add(item._id)
			items.push(item)
		}

		items.sort((a, b) => b._creationTime - a._creationTime)

		return Promise.all(items.map((item) => enrichProjectListItem(ctx, item)))
	},
})

export const listByOrganization = query({
	args: { organizationId: v.string() },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (
			!user ||
			!(await canModifyProject(
				ctx,
				{
					ownerType: 'organization',
					ownerId: args.organizationId,
				},
				user._id,
			))
		) {
			throw new Error('You do not have permission to view this organization')
		}

		const items = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', 'organization').eq('ownerId', args.organizationId),
			)
			.collect()

		items.sort((a, b) => b._creationTime - a._creationTime)

		return Promise.all(
			items.map((item) => enrichProjectListItem(ctx, item)),
		)
	},
})

/**
 * List projects for admin moderation.
 */
export const listAdmin = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('Not authenticated')
		if (user.role !== 'admin') throw new Error('Admin role required')

		const limit = Math.min(args.limit ?? 250, 500)
		const items = await ctx.db.query('projects').order('desc').take(limit)

		return Promise.all(
			items.map(async (item) => {
				const categories = await Promise.all(
					item.categoryIds.map((id) => ctx.db.get(id)),
				)

				const stats = await ctx.db
					.query('projectStats')
					.withIndex('by_project', (q) => q.eq('projectId', item._id))
					.first()

				const iconUrl = await resolveProjectIconUrl(item)
				const bannerUrl = await resolveProjectBannerUrl(item)
				const ownerLabels = await resolveProjectOwnerLabels(ctx, item)

				return {
					...item,
					iconUrl,
					bannerUrl,
					categories: categories.filter(Boolean),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
					totalDownloads: stats?.totalDownloads ?? 0,
					...ownerLabels,
				}
			}),
		)
	},
})


// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create new project
 */
export const create = mutation({
	args: {
		type: projectType,
		name: v.string(),
		summary: v.string(),
		description: v.string(),
		categoryIds: v.array(v.id('projectCategories')),
		metadata: v.optional(projectMetadata),
		sourceUrl: v.optional(v.string()),
		websiteUrl: v.optional(v.string()),
		issueTrackerUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		donationUrl: v.optional(v.string()),
		ownerType: v.union(v.literal('user'), v.literal('organization')),
		ownerId: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to create a project')
		}

		const ownerType = args.ownerType
		const ownerId = ownerType === 'user' ? user._id : args.ownerId
		if (!(await canModifyProject(ctx, { ownerType, ownerId }, user._id))) {
			throw new Error(
				'You do not have permission to create projects for this owner',
			)
		}
		await enforceRateLimit(
			ctx,
			'contentCreate',
			user._id,
			'Too many projects created. Please wait before creating another project.',
		)
		await assertCategoriesMatchProjectType(ctx, args.categoryIds, args.type)
		assertMetadataMatchesProjectType(args.type, args.metadata)

		const slug = generateSlug(args.name)

		// Check for duplicate slug
		const existing = await ctx.db
			.query('projects')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.first()

		if (existing) {
			throw new Error('A project with this name already exists')
		}

		const now = Date.now()

		const projectId = await ctx.db.insert('projects', {
			type: normalizeProjectType(args.type),
			name: args.name,
			slug,
			summary: args.summary,
			description: args.description,
			categoryIds: args.categoryIds,
			metadata: args.metadata,
			sourceUrl: args.sourceUrl,
			websiteUrl: args.websiteUrl,
			issueTrackerUrl: args.issueTrackerUrl,
			wikiUrl: args.wikiUrl,
			discordUrl: args.discordUrl,
			donationUrl: args.donationUrl,
			ownerType,
			ownerId,
			createdBy: user._id,
			status: 'draft',
			updatedAt: now,
		})

		// Create initial stats
		await ctx.db.insert('projectStats', {
			projectId,
			totalDownloads: 0,
			averageRating: 0,
			reviewCount: 0,
			updatedAt: now,
		})

		return { id: projectId, slug }
	},
})

/**
 * Update project
 */
export const update = mutation({
	args: {
		id: v.id('projects'),
		organizationId: v.optional(v.string()),
		type: v.optional(projectType),
		name: v.optional(v.string()),
		summary: v.optional(v.string()),
		description: v.optional(v.string()),
		categoryIds: v.optional(v.array(v.id('projectCategories'))),
		metadata: v.optional(projectMetadata),
		iconR2Key: v.optional(v.union(v.string(), v.null())),
		bannerR2Key: v.optional(v.union(v.string(), v.null())),
		sourceUrl: v.optional(v.string()),
		websiteUrl: v.optional(v.string()),
		issueTrackerUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		donationUrl: v.optional(v.string()),
		license: v.optional(v.string()),
		licenseCustom: v.optional(v.string()),
		status: v.optional(v.literal('under_review')),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to update a project')
		}

		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Project not found')
		}

		// Check ownership — user-owned or org member
		if (!(await canModifyProject(ctx, item, user._id))) {
			throw new Error('You do not have permission to edit this project')
		}

		const now = Date.now()
		const {
			id,
			organizationId,
			status,
			iconR2Key: nextIconR2Key,
			bannerR2Key: nextBannerR2Key,
			...updates
		} = args
		const mediaUpdates = {
			...(nextIconR2Key !== undefined
				? {
						iconR2Key: nextIconR2Key === null ? undefined : nextIconR2Key,
					}
				: {}),
			...(nextBannerR2Key !== undefined
				? {
						bannerR2Key:
							nextBannerR2Key === null ? undefined : nextBannerR2Key,
					}
				: {}),
		}
		if (nextIconR2Key && nextIconR2Key !== item.iconR2Key) {
			await validateEntityImageUpload(ctx, {
				key: nextIconR2Key,
				resourceType: 'projects',
				entityId: item._id,
				imageKind: 'icon',
			})
		}
		if (nextBannerR2Key && nextBannerR2Key !== item.bannerR2Key) {
			await validateEntityImageUpload(ctx, {
				key: nextBannerR2Key,
				resourceType: 'projects',
				entityId: item._id,
				imageKind: 'banner',
			})
		}

		const nextType = args.type ?? item.type
		const nextCategoryIds = args.categoryIds ?? item.categoryIds
		await assertCategoriesMatchProjectType(ctx, nextCategoryIds, nextType)
		assertMetadataMatchesProjectType(nextType, args.metadata ?? item.metadata)

		if (
			args.type &&
			normalizeProjectType(args.type) !== normalizeProjectType(item.type)
		) {
			const existingVersion = await ctx.db
				.query('projectVersions')
				.withIndex('by_project', (q) => q.eq('projectId', item._id))
				.first()
			if (existingVersion) {
				throw new Error('A project type cannot change after a release is added')
			}
		}
		if (status === 'under_review' && item.status !== 'draft') {
			throw new Error('Only draft projects can be submitted for review')
		}
		if (status === 'under_review') {
			await assertProjectHasVersion(ctx, item._id)
		}

		const lifecycleUpdates =
			status === 'under_review'
				? {
						status,
						moderationStatus: 'pending' as const,
					}
				: {}

		const shouldUpdateOwner = 'organizationId' in args
		const ownerUpdates = shouldUpdateOwner
			? {
					ownerType: organizationId ? 'organization' as const : 'user' as const,
					ownerId: organizationId ?? user._id,
				}
			: {}

		if (
			shouldUpdateOwner &&
			!(await canModifyProject(
				ctx,
				{
					ownerType: organizationId ? 'organization' : 'user',
					ownerId: organizationId ?? user._id,
				},
				user._id,
			))
		) {
			throw new Error(
				'You do not have permission to move this project to that owner',
			)
		}

		// If name changed, update slug
		let slug: string | undefined
		if (updates.name) {
			slug = generateSlug(updates.name)
			const existing = await ctx.db
				.query('projects')
				.withIndex('by_slug', (q) => q.eq('slug', slug as string))
				.first()
			if (existing && existing._id !== id) {
				throw new Error('A project with this name already exists')
			}
		}

		await ctx.db.patch(id, {
			...updates,
			...(updates.type
				? { type: normalizeProjectType(updates.type) }
				: {}),
			...mediaUpdates,
			...lifecycleUpdates,
			...ownerUpdates,
			...(slug ? { slug } : {}),
			updatedAt: now,
		})

		if (
			nextIconR2Key !== undefined &&
			item.iconR2Key &&
			nextIconR2Key !== item.iconR2Key
		) {
			await r2.deleteObject(ctx, item.iconR2Key)
		}
		if (
			nextBannerR2Key !== undefined &&
			item.bannerR2Key &&
			nextBannerR2Key !== item.bannerR2Key
		) {
			await r2.deleteObject(ctx, item.bannerR2Key)
		}

		return id
	},
})

export const getAdminReview = query({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (user.role !== 'admin') {
			throw new Error('Admin role required')
		}

		const project = await ctx.db.get(args.id)
		if (!project) {
			return null
		}

		const [detail, gallery, versions] = await Promise.all([
			enrichProjectDetail(ctx, project),
			ctx.db
				.query('projectGallery')
				.withIndex('by_project_sort', (q) =>
					q.eq('projectId', project._id),
				)
				.collect(),
			ctx.db
				.query('projectVersions')
				.withIndex('by_project', (q) =>
					q.eq('projectId', project._id),
				)
				.order('desc')
				.collect(),
		])

		return {
			...detail,
			gallery: await Promise.all(
				gallery.map(async (item) => ({
					...item,
					url: await resolveCdnObjectUrl(
						item.r2Key,
						R2_IMAGE_URL_EXPIRES_IN,
					),
				})),
			),
			versions,
		}
	},
})

/**
 * Delete project
 */
export const remove = mutation({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to delete a project')
		}

		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Project not found')
		}

		// Check ownership — user-owned or org member
		if (!(await canModifyProject(ctx, item, user._id))) {
			throw new Error('You do not have permission to delete this project')
		}

		await deleteProjectFiles(ctx, item)
		await deleteProjectRelatedRows(ctx, args.id)
		await ctx.db.delete(args.id)
	},
})

/**
 * Admin update - toggle status/moderation (no ownership check)
 */
export const adminUpdate = mutation({
	args: {
		id: v.id('projects'),
		status: v.optional(v.union(
			v.literal('draft'),
			v.literal('published'),
			v.literal('under_review'),
		)),
		moderationStatus: v.optional(projectModerationStatus),
		moderationReason: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('Not authenticated')
		}
		if (user.role !== 'admin') {
			throw new Error('Admin role required')
		}

		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Project not found')
		}

		const now = Date.now()
		const patch: Record<string, unknown> = { updatedAt: now }

		if (args.status !== undefined) {
			if (args.status === 'published') {
				await assertProjectHasVersion(ctx, item._id)
			}

			patch.status = args.status
			if (args.status === 'published' && !item.publishedAt) {
				patch.publishedAt = now
			}
			if (args.moderationStatus === undefined) {
				patch.moderationStatus =
					args.status === 'published' ? 'approved' : 'pending'
				patch.moderatedAt = now
				patch.moderatedBy = user._id
				if (args.status === 'published') {
					patch.moderationReason = undefined
				}
			}
		}
		if (args.moderationStatus !== undefined) {
			patch.moderationStatus = args.moderationStatus
			patch.moderatedAt = now
			patch.moderatedBy = user._id
			patch.moderationReason =
				args.moderationStatus === 'approved'
					? undefined
					: args.moderationReason?.trim() || undefined
		}
		if (
			(args.moderationStatus === 'rejected' ||
				args.moderationStatus === 'flagged') &&
			!args.moderationReason?.trim()
		) {
			throw new Error('A moderation reason is required')
		}
		await ctx.db.patch(args.id, patch)
		if (args.status !== undefined || args.moderationStatus !== undefined) {
			const nextStatus = args.status ?? item.status
			const nextModerationStatus =
				args.moderationStatus ??
				(args.status !== undefined
					? args.status === 'published'
						? 'approved'
						: 'pending'
					: item.moderationStatus)
			await ctx.scheduler.runAfter(
				0,
				internal.functions.projects.artifactDelivery.syncProjectDelivery,
				{
					projectId: args.id,
					published:
						nextStatus === 'published' &&
						nextModerationStatus === 'approved',
				},
			)
		}

		return args.id
	},
})

/**
 * List projects pending moderation review (admin only)
 */
export const listPendingModeration = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('Not authenticated')
		if (user.role !== 'admin') throw new Error('Admin role required')

		const limit = args.limit ?? 50

		const items = await ctx.db
			.query('projects')
			.withIndex('by_moderation_status', (q) =>
				q.eq('moderationStatus', 'pending'),
			)
			.take(limit)

		return Promise.all(
			items.map(async (item) => {
				const iconUrl = await resolveProjectIconUrl(item)

				const owner = await authComponent.getAnyUserById(ctx, item.createdBy)
				const ownerName =
					((owner as Record<string, unknown> | null)?.displayUsername as string | undefined) ??
					((owner as Record<string, unknown> | null)?.username as string | undefined) ??
					((owner as Record<string, unknown> | null)?.email as string | undefined) ??
					'Unknown'

				return {
					...item,
					iconUrl,
					ownerName,
				}
			}),
		)
	},
})

/**
 * Admin delete - no ownership check
 */
export const adminRemove = mutation({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('Not authenticated')
		}
		if (user.role !== 'admin') {
			throw new Error('Admin role required')
		}

		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Project not found')
		}

		await deleteProjectFiles(ctx, item)
		await deleteProjectRelatedRows(ctx, args.id)
		await ctx.db.delete(args.id)
	},
})
