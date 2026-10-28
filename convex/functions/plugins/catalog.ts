import {
	paginationOptsValidator,
	paginationResultValidator,
} from 'convex/server'
import { v } from 'convex/values'

import type { Doc } from '../../_generated/dataModel'
import { components } from '../../_generated/api'
import { type QueryCtx, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { softwareIdsWithWorkflows } from '../../lib/plugins/workflowTemplates'
import {
	getOrganizationById,
	getOrganizationBySlug,
} from '../../lib/plugins/authorization'
import {
	countPublishedProjectsForSoftware,
	countPublishedProjectsForSoftwareBatch,
} from '../../lib/plugins/aggregates'

// The hub account that owns a personally published plugin; links to
// /user/[username].
const publicCreatorValidator = v.object({
	username: v.string(),
	displayName: v.string(),
	avatarUrl: v.optional(v.string()),
})

async function getPublicCreator(ctx: QueryCtx, userId: string) {
	const user = await authComponent.getAnyUserById(ctx, userId)
	if (!user?.username || user.banned) {
		return null
	}
	return {
		username: user.username,
		displayName: user.displayUsername ?? user.name,
		avatarUrl: user.image ?? undefined,
	}
}

const publicOrganizationValidator = v.object({
	slug: v.string(),
	name: v.string(),
	avatarUrl: v.optional(v.string()),
})

const publicSoftwareValidator = v.object({
	slug: v.string(),
	name: v.string(),
})

const latestVersionSummaryValidator = v.object({
	version: v.string(),
	publishedAt: v.optional(v.number()),
	verifiedBuild: v.boolean(),
})

export const projectCardValidator = v.object({
	projectId: v.id('plugins'),
	slug: v.string(),
	name: v.string(),
	summary: v.string(),
	license: v.optional(v.string()),
	iconUrl: v.optional(v.string()),
	categories: v.array(v.object({ slug: v.string(), name: v.string() })),
	ratingAverage: v.number(),
	ratingCount: v.number(),
	publishedAt: v.optional(v.number()),
	updatedAt: v.number(),
	software: publicSoftwareValidator,
	creator: v.union(publicCreatorValidator, v.null()),
	organization: v.union(publicOrganizationValidator, v.null()),
	latestVersion: v.union(latestVersionSummaryValidator, v.null()),
})

type ProjectCard = typeof projectCardValidator.type

async function hydrateProjectCard(
	ctx: QueryCtx,
	project: Doc<'plugins'>,
): Promise<ProjectCard | null> {
	const [software, creator, organization, latestVersion, categories] =
		await Promise.all([
			ctx.db.get('serverSoftware', project.softwareId),
			project.ownerType === 'user'
				? getPublicCreator(ctx, project.ownerId)
				: null,
			project.ownerType === 'organization'
				? getOrganizationById(ctx, project.ownerId)
				: null,
			project.latestVersionId
				? ctx.db.get('pluginVersions', project.latestVersionId)
				: null,
			Promise.all(
				(project.categoryIds ?? []).map((id) =>
					ctx.db.get('pluginCategories', id),
				),
			),
		])

	if (!software) {
		return null
	}

	let latestVersionSummary: ProjectCard['latestVersion'] = null
	if (latestVersion?.status === 'published') {
		const release = await ctx.db
			.query('pluginReleases')
			.withIndex('by_version_id', (index) =>
				index.eq('versionId', latestVersion._id),
			)
			.first()
		latestVersionSummary = {
			version: latestVersion.version,
			publishedAt: latestVersion.publishedAt,
			verifiedBuild: release?.traceable === true,
		}
	}

	return {
		projectId: project._id,
		slug: project.slug,
		name: project.name,
		summary: project.summary,
		license: project.license,
		iconUrl: project.iconUrl,
		categories: categories.flatMap((category) =>
			category?.isActive
				? [{ slug: category.slug, name: category.name }]
				: [],
		),
		ratingAverage: project.ratingAverage,
		ratingCount: project.ratingCount,
		publishedAt: project.publishedAt,
		updatedAt: project.updatedAt,
		software: { slug: software.slug, name: software.name },
		creator,
		organization: organization
			? {
					slug: organization.slug,
					name: organization.name,
					avatarUrl: organization.logo ?? undefined,
				}
			: null,
		latestVersion: latestVersionSummary,
	}
}

async function hydrateProjectPage(
	ctx: QueryCtx,
	projects: Array<Doc<'plugins'>>,
) {
	const cards = await Promise.all(
		projects.map((project) => hydrateProjectCard(ctx, project)),
	)
	return cards.filter((card): card is ProjectCard => card !== null)
}

const CATEGORY_SCAN_LIMIT = 500
const MAX_SLUG_FILTERS = 20

const sortValidator = v.union(
	v.literal('relevance'),
	v.literal('latest'),
	v.literal('rating'),
)

/** Distinct slugs from the page URL, capped. */
function cleanSlugs(slugs: string[] | undefined) {
	return [...new Set((slugs ?? []).map((slug) => slug.trim()))]
		.filter(Boolean)
		.slice(0, MAX_SLUG_FILTERS)
}

export const explore = query({
	args: {
		paginationOpts: paginationOptsValidator,
		search: v.optional(v.string()),
		// Any of these server software, by slug.
		softwareSlugs: v.optional(v.array(v.string())),
		// Any of these categories, by slug.
		categorySlugs: v.optional(v.array(v.string())),
		sort: sortValidator,
	},
	returns: paginationResultValidator(projectCardValidator),
	handler: async (ctx, args) => {
		const empty = { page: [], isDone: true, continueCursor: '' }
		const categorySlugs = cleanSlugs(args.categorySlugs)
		const softwareSlugs = cleanSlugs(args.softwareSlugs)
		const categories = (
			await Promise.all(
				categorySlugs.map((slug) =>
					ctx.db
						.query('pluginCategories')
						.withIndex('by_slug', (q) => q.eq('slug', slug))
						.unique(),
				),
			)
		).flatMap((category) => (category?.isActive ? [category._id] : []))
		const softwareIds = (
			await Promise.all(
				softwareSlugs.map((slug) =>
					ctx.db
						.query('serverSoftware')
						.withIndex('by_slug', (q) => q.eq('slug', slug))
						.unique(),
				),
			)
		).flatMap((software) => (software ? [software._id] : []))
		// Nothing can match only categories or software that do not exist.
		if (
			(categorySlugs.length > 0 && categories.length === 0) ||
			(softwareSlugs.length > 0 && softwareIds.length === 0)
		) {
			return empty
		}

		// Categories, or more than one software, narrow the newest published
		// plugins in memory: plugins are few, and array membership cannot be
		// indexed.
		if (categories.length > 0 || softwareIds.length > 1) {
			const term = args.search?.trim().toLowerCase()
			const plugins = await ctx.db
				.query('plugins')
				.withIndex('by_visibility_and_status_and_updated_at', (index) =>
					index.eq('visibility', 'public').eq('status', 'published'),
				)
				.order('desc')
				.take(CATEGORY_SCAN_LIMIT)
			const matching = plugins.filter(
				(plugin) =>
					(categories.length === 0 ||
						categories.some((id) => plugin.categoryIds?.includes(id))) &&
					(softwareIds.length === 0 ||
						softwareIds.includes(plugin.softwareId)) &&
					(!term || plugin.searchText.toLowerCase().includes(term)),
			)
			if (args.sort === 'rating') {
				matching.sort(
					(a, b) => b.ratingAverage - a.ratingAverage,
				)
			}
			return {
				page: await hydrateProjectPage(
					ctx,
					matching.slice(0, args.paginationOpts.numItems),
				),
				isDone: true,
				continueCursor: '',
			}
		}
		const search = args.search?.trim().slice(0, 100)
		const [softwareId] = softwareIds

		if (search) {
			const result = softwareId
				? await ctx.db
						.query('plugins')
						.withSearchIndex('search_search_text', (index) =>
							index
								.search('searchText', search)
								.eq('visibility', 'public')
								.eq('status', 'published')
								.eq('softwareId', softwareId),
						)
						.paginate(args.paginationOpts)
				: await ctx.db
						.query('plugins')
						.withSearchIndex('search_search_text', (index) =>
							index
								.search('searchText', search)
								.eq('visibility', 'public')
								.eq('status', 'published'),
						)
						.paginate(args.paginationOpts)

			return {
				...result,
				page: await hydrateProjectPage(ctx, result.page),
			}
		}

		if (softwareId) {
			if (args.sort === 'rating') {
				const result = await ctx.db
					.query('plugins')
					.withIndex(
						'by_visibility_and_status_and_software_id_and_rating_average',
						(index) =>
							index
								.eq('visibility', 'public')
								.eq('status', 'published')
								.eq('softwareId', softwareId),
					)
					.order('desc')
					.paginate(args.paginationOpts)
				return {
					...result,
					page: await hydrateProjectPage(ctx, result.page),
				}
			}
			const result = await ctx.db
				.query('plugins')
				.withIndex(
					'by_visibility_and_status_and_software_id_and_updated_at',
					(index) =>
						index
							.eq('visibility', 'public')
							.eq('status', 'published')
							.eq('softwareId', softwareId),
				)
				.order('desc')
				.paginate(args.paginationOpts)
			return {
				...result,
				page: await hydrateProjectPage(ctx, result.page),
			}
		}

		if (args.sort === 'rating') {
			const result = await ctx.db
				.query('plugins')
				.withIndex(
					'by_visibility_and_status_and_rating_average',
					(index) =>
						index
							.eq('visibility', 'public')
							.eq('status', 'published'),
				)
				.order('desc')
				.paginate(args.paginationOpts)
			return {
				...result,
				page: await hydrateProjectPage(ctx, result.page),
			}
		}
		const result = await ctx.db
			.query('plugins')
			.withIndex('by_visibility_and_status_and_updated_at', (index) =>
				index.eq('visibility', 'public').eq('status', 'published'),
			)
			.order('desc')
			.paginate(args.paginationOpts)
		return { ...result, page: await hydrateProjectPage(ctx, result.page) }
	},
})

const softwareDirectoryItemValidator = v.object({
	slug: v.string(),
	name: v.string(),
	description: v.string(),
	logoUrl: v.optional(v.string()),
	// Whether plugins can be published for this software (it has a workflow).
	supportsPlugins: v.boolean(),
	websiteUrl: v.optional(v.string()),
	repositoryUrl: v.optional(v.string()),
	projectCount: v.number(),
})

export const listSoftware = query({
	args: {},
	returns: v.array(softwareDirectoryItemValidator),
	handler: async (ctx) => {
		const software = await ctx.db
			.query('serverSoftware')
			.withIndex('by_enabled_and_sortOrder', (index) =>
				index.eq('enabled', true),
			)
			.take(50)

		const [projectCounts, withWorkflows] = await Promise.all([
			countPublishedProjectsForSoftwareBatch(
				ctx,
				software.map((item) => item._id),
			),
			softwareIdsWithWorkflows(ctx),
		])
		return software.map((item, index) => ({
			slug: item.slug,
			name: item.name,
			description: item.description,
			logoUrl: item.logoUrl,
			supportsPlugins: withWorkflows.has(item._id),
			websiteUrl: item.websiteUrl,
			repositoryUrl: item.repositoryUrl,
			projectCount: projectCounts[index] ?? 0,
		}))
	},
})

export const getSoftware = query({
	args: { slug: v.string() },
	returns: v.union(
		v.object({
			software: softwareDirectoryItemValidator,
			projects: v.array(projectCardValidator),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const software = await ctx.db
			.query('serverSoftware')
			.withIndex('by_slug', (index) => index.eq('slug', args.slug))
			.unique()
		if (!software?.enabled) {
			return null
		}
		const [projects, projectCount, withWorkflows] = await Promise.all([
			ctx.db
				.query('plugins')
				.withIndex(
					'by_visibility_and_status_and_software_id_and_updated_at',
					(index) =>
						index
							.eq('visibility', 'public')
							.eq('status', 'published')
							.eq('softwareId', software._id),
				)
				.order('desc')
				.take(24),
			countPublishedProjectsForSoftware(ctx, software._id),
			softwareIdsWithWorkflows(ctx),
		])
		return {
			software: {
				slug: software.slug,
				name: software.name,
				description: software.description,
				logoUrl: software.logoUrl,
				supportsPlugins: withWorkflows.has(software._id),
				websiteUrl: software.websiteUrl,
				repositoryUrl: software.repositoryUrl,
				projectCount,
			},
			projects: await hydrateProjectPage(ctx, projects),
		}
	},
})

const publicAssetValidator = v.object({
	name: v.string(),
	size: v.number(),
	sha256: v.optional(v.string()),
})

const publicBuildValidator = v.object({
	workflowRunId: v.number(),
	logsUrl: v.string(),
	commitSha: v.string(),
	branch: v.optional(v.string()),
	conclusion: v.optional(v.string()),
})

const publicReleaseValidator = v.object({
	commitSha: v.string(),
	// The build ran the unmodified managed workflow ("Traceable build").
	verifiedBuild: v.boolean(),
	asset: v.union(publicAssetValidator, v.null()),
	build: v.union(publicBuildValidator, v.null()),
	githubReleaseUrl: v.optional(v.string()),
})

const publicVersionValidator = v.object({
	version: v.string(),
	normalizedVersion: v.string(),
	changelog: v.optional(v.string()),
	minecraftVersion: v.optional(v.string()),
	publishedAt: v.optional(v.number()),
	release: v.union(publicReleaseValidator, v.null()),
})

export const getProject = query({
	args: { slug: v.string() },
	returns: v.union(
		v.object({
			project: projectCardValidator,
			description: v.optional(v.string()),
			licenseCustom: v.optional(v.string()),
			repository: v.object({
				fullName: v.string(),
				htmlUrl: v.string(),
				defaultBranch: v.string(),
			}),
			links: v.object({
				website: v.optional(v.string()),
				wiki: v.optional(v.string()),
				discord: v.optional(v.string()),
				issues: v.optional(v.string()),
				donation: v.optional(v.string()),
			}),
			versions: v.array(publicVersionValidator),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const project = await ctx.db
			.query('plugins')
			.withIndex('by_slug', (index) => index.eq('slug', args.slug))
			.unique()
		if (
			project?.visibility !== 'public' ||
			project.status !== 'published'
		) {
			return null
		}
		const [card, repository, versions] = await Promise.all([
			hydrateProjectCard(ctx, project),
			ctx.db.get('githubRepositories', project.repositoryId),
			ctx.db
				.query('pluginVersions')
				.withIndex('by_project_id_and_status', (index) =>
					index
						.eq('projectId', project._id)
						.eq('status', 'published'),
				)
				.order('desc')
				.take(50),
		])
		// Files are served from the CDN, so a plugin stays up when the GitHub
		// App loses access to its repository.
		if (!card || !repository) {
			return null
		}

		const publicVersions = await Promise.all(
			versions.map(async (version) => {
				const release = await ctx.db
					.query('pluginReleases')
					.withIndex('by_version_id', (index) =>
						index.eq('versionId', version._id),
					)
					.first()
				const published =
					release?.status === 'published' ? release : null
				const build = published
					? await ctx.db.get('pluginBuilds', published.buildId)
					: null
				return {
					version: version.version,
					normalizedVersion: version.normalizedVersion,
					// Markdown; the page renders it without raw HTML.
					changelog: version.changelog,
					minecraftVersion: version.minecraftVersion,
					publishedAt: version.publishedAt,
					release: published
						? {
								commitSha: published.commitSha,
								verifiedBuild: published.traceable,
								asset:
									published.cdnKey &&
									published.fileName &&
									published.size !== undefined
										? {
												name: published.fileName,
												size: published.size,
												sha256: published.sha256,
											}
										: null,
								build: build
									? {
											workflowRunId: build.workflowRunId,
											logsUrl: build.logsUrl,
											commitSha: build.commitSha,
											branch: build.branch,
											conclusion: build.conclusion,
										}
									: null,
								...(published.githubReleaseStatus === 'created' &&
								published.githubReleaseUrl
									? { githubReleaseUrl: published.githubReleaseUrl }
									: {}),
							}
						: null,
				}
			}),
		)

		return {
			project: card,
			description: project.description,
			licenseCustom: project.licenseCustom,
			repository: {
				fullName: repository.fullName,
				htmlUrl: repository.htmlUrl,
				defaultBranch: repository.defaultBranch,
			},
			links: {
				website: project.websiteUrl,
				wiki: project.wikiUrl,
				discord: project.discordUrl,
				issues: project.issuesUrl,
				donation: project.donationUrl,
			},
			versions: publicVersions,
		}
	},
})

const ownerPluginsValidator = v.union(
	v.object({
		projects: v.array(projectCardValidator),
	}),
	v.null(),
)

async function listOwnerPlugins(
	ctx: QueryCtx,
	ownerType: 'user' | 'organization',
	ownerId: string,
) {
	const projects = await ctx.db
		.query('plugins')
		.withIndex(
			'by_owner_type_and_owner_id_and_visibility_and_status',
			(index) =>
				index
					.eq('ownerType', ownerType)
					.eq('ownerId', ownerId)
					.eq('visibility', 'public')
					.eq('status', 'published'),
		)
		.order('desc')
		.take(100)
	return { projects: await hydrateProjectPage(ctx, projects) }
}

/** Public plugins a user published personally, for their profile page. */
export const listByUsername = query({
	args: { username: v.string() },
	returns: ownerPluginsValidator,
	handler: async (ctx, args) => {
		const user = (await ctx.runQuery(
			components.betterAuth.adapter.findOne,
			{
				model: 'user',
				where: [{ field: 'username', value: args.username.trim() }],
			},
		)) as { _id: string; banned?: boolean | null } | null
		if (!user || user.banned) {
			return null
		}
		return await listOwnerPlugins(ctx, 'user', user._id)
	},
})

/** Public plugins an organization published, for its page. */
export const listByOrganizationSlug = query({
	args: { slug: v.string() },
	returns: ownerPluginsValidator,
	handler: async (ctx, args) => {
		const organization = await getOrganizationBySlug(ctx, args.slug)
		if (!organization) {
			return null
		}
		return await listOwnerPlugins(ctx, 'organization', organization._id)
	},
})

export const featured = query({
	args: { limit: v.number() },
	returns: v.array(projectCardValidator),
	handler: async (ctx, args) => {
		const projects = await ctx.db
			.query('plugins')
			.withIndex('by_visibility_and_status_and_updated_at', (index) =>
				index.eq('visibility', 'public').eq('status', 'published'),
			)
			.order('desc')
			.take(Math.min(Math.max(Math.floor(args.limit), 1), 12))
		return await hydrateProjectPage(ctx, projects)
	},
})

export const sitemapEntries = query({
	args: {},
	returns: v.array(v.object({ slug: v.string(), updatedAt: v.number() })),
	handler: async (ctx) => {
		const projects = await ctx.db
			.query('plugins')
			.withIndex('by_visibility_and_status', (index) =>
				index.eq('visibility', 'public').eq('status', 'published'),
			)
			.take(1_000)
		return projects.map((item) => ({
			slug: item.slug,
			updatedAt: item.updatedAt,
		}))
	},
})
