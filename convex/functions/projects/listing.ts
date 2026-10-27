import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { stream } from 'convex-helpers/server/stream'
import { normalizeProjectType } from '../../../lib/project-artifacts'
import { normalizeTags } from '../../../lib/tags'
import type { Doc, Id } from '../../_generated/dataModel'
import { type QueryCtx, query } from '../../_generated/server'
import { isPublicProject } from '../../lib/contentVisibility'
import { resolveCdnObjectUrl } from '../../lib/r2'
import schema from '../../schema'
import { projectDiscoveryType } from '../../schemas/projects'

/**
 * The shared public listing behind /addons and /resource-packs.
 *
 * Browsing reads `projectStats` in index order (one index per sort, with and
 * without a type), so no sort ever loads and sorts the whole catalogue. The
 * listing fields on those documents are kept by lib/discovery.ts.
 *
 * Searching reads the `search_text` index on `projects` instead; results come
 * back by relevance and `sort` is ignored.
 *
 * Filters that no index covers are applied to the rows as they are read, up
 * to MAX_ROWS_PER_PAGE per request. A page can therefore come back short, or
 * empty, while `isDone` is still false; callers keep loading until it is true.
 */

const MAX_PAGE_SIZE = 48
const MAX_ROWS_PER_PAGE = 400
const MAX_QUERY_LENGTH = 100
const MAX_CATEGORY_FILTERS = 20
const MAX_TAG_FILTERS = 5
const ICON_URL_EXPIRES_IN = 60 * 60 * 24 * 7

const sortValidator = v.union(
	v.literal('downloads'),
	v.literal('trending'),
	v.literal('updated'),
	v.literal('newest'),
	v.literal('rating'),
	v.literal('saved'),
)

const SORT_INDEX = {
	downloads: 'by_isPublic_and_totalDownloads',
	trending: 'by_isPublic_and_trendingScore',
	updated: 'by_isPublic_and_lastReleaseAt',
	newest: 'by_isPublic_and_publishedAt',
	rating: 'by_isPublic_and_averageRating',
	saved: 'by_isPublic_and_favouriteCount',
} as const

const SORT_INDEX_BY_TYPE = {
	downloads: 'by_isPublic_and_type_and_totalDownloads',
	trending: 'by_isPublic_and_type_and_trendingScore',
	updated: 'by_isPublic_and_type_and_lastReleaseAt',
	newest: 'by_isPublic_and_type_and_publishedAt',
	rating: 'by_isPublic_and_type_and_averageRating',
	saved: 'by_isPublic_and_type_and_favouriteCount',
} as const

const filterArgs = {
	type: v.optional(projectDiscoveryType),
	// Any of these categories. Plain strings because they arrive from the
	// page URL; anything that is not a category ID is ignored.
	categoryIds: v.optional(v.array(v.string())),
	experimentalFeaturesRequired: v.optional(v.boolean()),
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
	// A Minecraft version some public release supports, e.g. "1.21.80".
	gameVersion: v.optional(v.string()),
	// Every tag must be present.
	tags: v.optional(v.array(v.string())),
	// Last release at or after this time. The client passes it (rounded, so
	// results stay cacheable) because queries must not read the clock.
	updatedAfter: v.optional(v.number()),
}

interface Filters {
	type?: Doc<'projectStats'>['type']
	categoryIds: Id<'projectCategories'>[]
	experimentalFeaturesRequired?: boolean
	resourcePackResolution?: string
	resourcePackContentType?: string
	gameVersion?: string
	tags: string[]
	updatedAfter?: number
}

function matchesMetadata(project: Doc<'projects'>, filters: Filters) {
	const metadata = project.metadata
	if (
		filters.experimentalFeaturesRequired !== undefined &&
		(metadata?.type !== 'addon' ||
			metadata.experimentalFeaturesRequired !==
				filters.experimentalFeaturesRequired)
	) {
		return false
	}
	if (
		filters.resourcePackResolution &&
		(metadata?.type !== 'resource_pack' ||
			metadata.resolution !== filters.resourcePackResolution)
	) {
		return false
	}
	const contentType = filters.resourcePackContentType
	if (
		contentType &&
		(metadata?.type !== 'resource_pack' ||
			!metadata.contentTypes.some((item) => item === contentType))
	) {
		return false
	}
	return true
}

/** Everything the listing checks on the project itself. */
function matchesFilters(project: Doc<'projects'>, filters: Filters) {
	if (!isPublicProject(project)) {
		return false
	}
	if (filters.type && normalizeProjectType(project.type) !== filters.type) {
		return false
	}
	if (
		filters.categoryIds.length > 0 &&
		!filters.categoryIds.some((id) => project.categoryIds.includes(id))
	) {
		return false
	}
	if (
		filters.gameVersion &&
		!project.supportedGameVersions?.includes(filters.gameVersion)
	) {
		return false
	}
	if (!filters.tags.every((tag) => project.tags?.includes(tag))) {
		return false
	}
	if (
		filters.updatedAfter !== undefined &&
		(project.latestVersionAt ?? 0) < filters.updatedAfter
	) {
		return false
	}
	return matchesMetadata(project, filters)
}

interface Row {
	project: Doc<'projects'>
	stats: Doc<'projectStats'> | null
}

/** The shape every public project card is drawn from. */
export async function toCards(ctx: QueryCtx, rows: Row[]) {
	const categoryIds = [
		...new Set(rows.flatMap((row) => row.project.categoryIds)),
	]
	const categories = new Map(
		(
			await Promise.all(
				categoryIds.map((id) => ctx.db.get('projectCategories', id)),
			)
		).flatMap((category) =>
			category ? [[category._id, category] as const] : [],
		),
	)
	return await Promise.all(
		rows.map(async ({ project, stats }) => ({
			...project,
			iconUrl: project.iconR2Key
				? await resolveCdnObjectUrl(
						project.iconR2Key,
						ICON_URL_EXPIRES_IN,
					)
				: undefined,
			categories: project.categoryIds.flatMap((id) => {
				const category = categories.get(id)
				return category ? [category] : []
			}),
			averageRating: stats?.averageRating ?? 0,
			reviewCount: stats?.reviewCount ?? 0,
			totalDownloads: stats?.totalDownloads ?? 0,
			favouriteCount: stats?.favouriteCount ?? 0,
		})),
	)
}

export const browse = query({
	args: {
		paginationOpts: paginationOptsValidator,
		query: v.optional(v.string()),
		sort: v.optional(sortValidator),
		...filterArgs,
	},
	handler: async (ctx, args) => {
		const paginationOpts = {
			...args.paginationOpts,
			numItems: Math.min(
				Math.max(Math.floor(args.paginationOpts.numItems), 1),
				MAX_PAGE_SIZE,
			),
		}
		const filters: Filters = {
			type: args.type,
			categoryIds: (args.categoryIds ?? [])
				.slice(0, MAX_CATEGORY_FILTERS)
				.flatMap((value) => {
					const id = ctx.db.normalizeId('projectCategories', value)
					return id ? [id] : []
				}),
			experimentalFeaturesRequired: args.experimentalFeaturesRequired,
			resourcePackResolution: args.resourcePackResolution,
			resourcePackContentType: args.resourcePackContentType,
			gameVersion: args.gameVersion?.trim() || undefined,
			tags: normalizeTags(args.tags ?? []).slice(0, MAX_TAG_FILTERS),
			updatedAfter: args.updatedAfter,
		}
		const text = args.query?.trim().slice(0, MAX_QUERY_LENGTH)

		if (text) {
			const result = await ctx.db
				.query('projects')
				.withSearchIndex('search_text', (q) =>
					q
						.search('searchText', text)
						.eq('status', 'published')
						.eq('moderationStatus', 'approved'),
				)
				.paginate(paginationOpts)
			const matches = result.page.filter((project) =>
				matchesFilters(project, filters),
			)
			const rows = await Promise.all(
				matches.map(async (project) => ({
					project,
					stats: await ctx.db
						.query('projectStats')
						.withIndex('by_project', (q) =>
							q.eq('projectId', project._id),
						)
						.first(),
				})),
			)
			return { ...result, page: await toCards(ctx, rows) }
		}

		const sort = args.sort ?? 'downloads'
		const { type } = filters
		const stats = stream(ctx.db, schema).query('projectStats')
		const ordered = type
			? stats.withIndex(SORT_INDEX_BY_TYPE[sort], (q) =>
					q.eq('isPublic', true).eq('type', type),
				)
			: stats.withIndex(SORT_INDEX[sort], (q) => q.eq('isPublic', true))
		const result = await ordered
			.order('desc')
			.map(async (row): Promise<Row | null> => {
				const project = await ctx.db.get('projects', row.projectId)
				return project && matchesFilters(project, filters)
					? { project, stats: row }
					: null
			})
			.paginate({ ...paginationOpts, maximumRowsRead: MAX_ROWS_PER_PAGE })
		return { ...result, page: await toCards(ctx, result.page) }
	},
})

const SITEMAP_LIMIT = 2000

/** Address and last change of every public project, newest first, for the sitemap. */
export const sitemapEntries = query({
	args: {},
	returns: v.array(
        v.object({
            slug: v.string(),
            type: projectDiscoveryType,
            updatedAt: v.number(),
        }),
    ),
	handler: async (ctx) => {
		const listed = await ctx.db
			.query('projectStats')
			.withIndex('by_isPublic_and_publishedAt', (q) =>
				q.eq('isPublic', true),
			)
			.order('desc')
			.take(SITEMAP_LIMIT)
		const projects = await Promise.all(
			listed.map((stats) => ctx.db.get('projects', stats.projectId)),
		)
		return projects.flatMap((project) =>
			project && isPublicProject(project)
				? [{
                    slug: project.slug,
                    type: normalizeProjectType(project.type),
                    updatedAt: project.updatedAt,
                }]
				: [],
		)
	},
})
