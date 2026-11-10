import {
	deleteUnretainedMedia,
	recordSubmission,
} from '../../lib/moderationHistory'
import {
	assertSubmissionEditable,
	assertReviewRevision,
	decisionFields,
	hasApprovedListing,
	moderationReason,
	snapshot,
	snapshotPatch,
	submissionView,
} from '../../lib/submissions'
import { allocateProjectPublicId } from '../../lib/projectPublicIds'
import { resolveProjectReference } from '../../lib/contentReferences'
import { ConvexError, v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { toPublicProject } from '../../lib/publicContent'
import { adminMutation, moderatorMutation, moderatorQuery } from '../../lib/functions'
import type { Doc, Id } from '../../_generated/dataModel'
import {
	moderationStatus as projectModerationStatus,
	projectMetadata,
	projectType,
} from '../../schemas/projects'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import {
	canModifyProjectOwner,
	ownerFromOrganization,
} from '../../lib/contentOwnership'
import {
	isPublicProject,
	requiresModerationReason,
} from '../../lib/contentVisibility'
import { validateEntityImageUpload } from '../../lib/media'
import {
	getPublishedReleaseKey,
	isPublicRelease,
	isValidatedRelease,
} from '../../lib/projectReleases'
import { r2, resolveCdnObjectUrl, uploadsR2 } from '../../lib/r2'
import {
	normalizeTagsField,
	validateProjectFields,
} from '../../lib/contentValidation'
import { afterProjectWrite, recordReleaseActivity } from '../../lib/activity'
import { recordAdminAction } from '../../lib/audit'
import { recordEditorMediaReferences } from '../../lib/editorMedia'
import { enforceRateLimit } from '../../lib/rateLimits'
import {
	canEditContent,
	canManageContent,
	isAffiliatedWithContent,
} from '../../lib/permissions'
import {
	normalizeProjectType,
	type StoredProjectType,
} from '../../../lib/project-artifacts'
import { updateProjectReleaseSummary } from './artifactValidation'
import { removePicksFor } from '../site/picks'

// =============================================================================
// TYPES
// =============================================================================

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
	const categories = await Promise.all(
		categoryIds.map((id) => ctx.db.get(id)),
	)
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
				throw new Error(
					'Dependency names must be between 1 and 80 characters',
				)
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

async function enrichProjectListItem(ctx: QueryCtx, item: Doc<'projects'>) {
	const categories = await Promise.all(
		item.categoryIds.map((id) => ctx.db.get(id)),
	)

	const stats = await ctx.db
		.query('projectStats')
		.withIndex('by_project', (q) => q.eq('projectId', item._id))
		.first()

	const iconUrl = await resolveProjectIconUrl(item)

	const pendingVersion =
		isPublicProject(item) && item.submissionStatus !== 'pending'
			? await ctx.db
					.query('projectVersions')
					.withIndex(
						'by_project_and_standalone_review_pending',
						(q) =>
							q
								.eq('projectId', item._id)
								.eq('standaloneReviewPending', true),
					)
					.first()
			: null
	return {
		...item,
		hasPendingVersions: !!pendingVersion,
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
	const versions = ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', projectId))
	for await (const version of versions) {
		if (
			isValidatedRelease(version) &&
			version.reviewStatus !== 'rejected'
		) {
			return true
		}
	}
	return false
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
		await deleteUnretainedMedia(ctx, key)
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
		await deleteUnretainedMedia(ctx, item.r2Key)
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
	await removePicksFor(ctx, { projectId })

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

	const days = await ctx.db
		.query('projectDailyStats')
		.withIndex('by_projectId_and_dayKey', (q) =>
			q.eq('projectId', projectId),
		)
		.collect()
	for (const item of days) {
		await ctx.db.delete(item._id)
	}
}

/** Everything a project's detail page shows beyond the document itself. */
async function projectDetailExtras(ctx: QueryCtx, item: Doc<'projects'>) {
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

	// Newer releases may still be validating, awaiting review, or rejected;
	// this result is public, so it must never describe one of those.
	const recentVersions = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', item._id))
		.order('desc')
		.take(50)
	const latestVersion = recentVersions.find(
		(release) =>
			isPublicRelease(release) &&
			Boolean(getPublishedReleaseKey(release)),
	)

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
		const org = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: 'organization',
			where: [{ field: '_id', value: item.ownerId }],
		})) as {
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
					fileName: latestVersion.fileName,
					fileSize: latestVersion.fileSize,
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
	return canEditContent(
		ctx,
		project,
		{ _id: userId },
		{ allowSiteAdmin: false },
	)
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

export const getPublishedBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const item = await resolveProjectReference(ctx, args.slug)

		if (!item || !isPublicProject(item)) {
			return null
		}

		return {
			...toPublicProject(item),
			...(await projectDetailExtras(ctx, item)),
		}
	},
})

/**
 * A project for its owner's edit pages, by id. A slug still resolves, so
 * links from before the dashboard used ids can redirect.
 */
export const getForEdit = query({
	args: { id: v.string() },
	handler: async (ctx, args) => {
		const now = Date.now()
		const dayKey = getUtcDayKey(now)
		const monthKey = getUtcMonthKey(now)

		const stored = await resolveProjectReference(ctx, args.id)
		const item = stored ? submissionView(stored) : null

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
			...submissionView(item),
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
			hasValidatedRelease: await projectHasVersion(ctx, item._id),
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

		return Promise.all(
			items.map((item) => enrichProjectListItem(ctx, item)),
		)
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
			throw new Error(
				'You do not have permission to view this organization',
			)
		}

		const items = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q) =>
				q
					.eq('ownerType', 'organization')
					.eq('ownerId', args.organizationId),
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
export const listAdmin = moderatorQuery({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
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
 * Create a new project draft. Only the name and summary are needed to start;
 * the description and categories can be added later and are checked when the
 * draft is submitted for review.
 */
export const create = mutation({
	args: {
		type: projectType,
		name: v.string(),
		summary: v.string(),
		description: v.optional(v.string()),
		categoryIds: v.optional(v.array(v.id('projectCategories'))),
		tags: v.optional(v.array(v.string())),
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
		const description = args.description ?? ''
		const categoryIds = args.categoryIds ?? []
		validateProjectFields({
			...args,
			// Both may be left empty on a draft.
			description: description.trim() ? description : undefined,
			categoryIds: categoryIds.length ? categoryIds : undefined,
		})

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
		await assertCategoriesMatchProjectType(ctx, categoryIds, args.type)
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

		const publicId = await allocateProjectPublicId(ctx, args.type)
		const projectId = await ctx.db.insert('projects', {
			publicId,
			type: normalizeProjectType(args.type),
			name: args.name,
			slug,
			summary: args.summary,
			description,
			categoryIds,
			tags: normalizeTagsField(args.tags),
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
		await afterProjectWrite(ctx, null, await ctx.db.get(projectId))

		await recordEditorMediaReferences(
			ctx,
			'projects',
			projectId,
			description,
		)

		return { id: projectId, slug, publicId }
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
		tags: v.optional(v.array(v.string())),
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

		const liveItem = await ctx.db.get(args.id)
		const item = liveItem ? submissionView(liveItem) : null
		if (!item) {
			throw new Error('Project not found')
		}

		// Check ownership — user-owned or org member
		if (!(await canModifyProject(ctx, item, user._id))) {
			throw new Error('You do not have permission to edit this project')
		}
		assertSubmissionEditable(item)
		validateProjectFields(args)

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
						iconR2Key:
							nextIconR2Key === null ? undefined : nextIconR2Key,
					}
				: {}),
			...(nextBannerR2Key !== undefined
				? {
						bannerR2Key:
							nextBannerR2Key === null
								? undefined
								: nextBannerR2Key,
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
		assertMetadataMatchesProjectType(
			nextType,
			args.metadata ?? item.metadata,
		)

		if (
			args.type &&
			normalizeProjectType(args.type) !== normalizeProjectType(item.type)
		) {
			const existingVersion = await ctx.db
				.query('projectVersions')
				.withIndex('by_project', (q) => q.eq('projectId', item._id))
				.first()
			if (existingVersion) {
				throw new Error(
					'A project type cannot change after a release is added',
				)
			}
		}
		if (
			status === 'under_review' &&
			item.status !== 'draft' &&
			!hasApprovedListing(item)
		) {
			throw new Error('Only draft projects can be submitted for review')
		}
		if (status === 'under_review' && item.moderationStatus === 'rejected') {
			throw new Error(
				'This project was rejected and cannot be resubmitted. Contact the moderators.',
			)
		}
		if (status === 'under_review') {
			validateProjectFields({ ...item, ...updates })
			await assertProjectHasVersion(ctx, item._id)
		}

		const lifecycleUpdates =
			status === 'under_review'
				? {
						status,
						moderationStatus: 'pending' as const,
						moderationReason: undefined,
					}
				: {}

		const shouldUpdateOwner = 'organizationId' in args
		const nextOwner = ownerFromOrganization(organizationId, user._id)
		const ownerUpdates = shouldUpdateOwner ? nextOwner : {}
		const ownerChanges =
			shouldUpdateOwner &&
			(nextOwner.ownerType !== item.ownerType ||
				nextOwner.ownerId !== item.ownerId)
		// Moving a project needs manage rights on its current owner and
		// membership in the new owner.
		if (
			ownerChanges &&
			!(
				(await canManageContent(ctx, item, user, {
					allowSiteAdmin: false,
				})) &&
				(await canEditContent(ctx, nextOwner, user, {
					allowSiteAdmin: false,
				}))
			)
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

		const changes = {
			...updates,
			...(updates.type
				? { type: normalizeProjectType(updates.type) }
				: {}),
			...(updates.tags ? { tags: normalizeTagsField(updates.tags) } : {}),
			...mediaUpdates,
			...lifecycleUpdates,
			...ownerUpdates,
			...(slug ? { slug } : {}),
			updatedAt: now,
		}
		const submittedVersions =
			status === 'under_review'
				? (
						await ctx.db
							.query('projectVersions')
							.withIndex('by_project', (q) =>
								q.eq('projectId', item._id),
							)
							.collect()
					)
						.filter(isValidatedRelease)
						.map((version) => version._id)
				: undefined
		await ctx.db.patch(id, {
			...(item.publishedAt || hasApprovedListing(item)
				? { draftChangesJson: snapshot(item, changes), ...ownerUpdates }
				: changes),
			...(status === 'under_review'
				? {
						submissionStatus: 'pending' as const,
						submissionReason: undefined,
						submittedAt: now,
						submittedVersionIds: submittedVersions,
					}
				: {}),
			submissionRevision: (item.submissionRevision ?? 0) + 1,
			updatedAt: now,
		})
		if (status === 'under_review')
			await recordSubmission(ctx, {
				content: liveItem!,
				details: { ...item, ...changes },
				actorId: user._id,
				revision: (item.submissionRevision ?? 0) + 1,
			})
		await afterProjectWrite(ctx, liveItem!, await ctx.db.get(id))
		await recordEditorMediaReferences(ctx, 'projects', id, args.description)

		if (
			!item.publishedAt &&
			!hasApprovedListing(item) &&
			nextIconR2Key !== undefined &&
			item.iconR2Key &&
			nextIconR2Key !== item.iconR2Key
		) {
			await deleteUnretainedMedia(ctx, item.iconR2Key)
		}
		if (
			!item.publishedAt &&
			!hasApprovedListing(item) &&
			nextBannerR2Key !== undefined &&
			item.bannerR2Key &&
			nextBannerR2Key !== item.bannerR2Key
		) {
			await deleteUnretainedMedia(ctx, item.bannerR2Key)
		}

		return id
	},
})

export const getAdminReview = moderatorQuery({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		const stored = await ctx.db.get(args.id)
		const project = stored
			? stored.submissionStatus === 'pending'
				? submissionView(stored)
				: stored
			: null
		if (!project) {
			return null
		}

		const [detail, gallery, versions] = await Promise.all([
			projectDetailExtras(ctx, project).then((extras) => ({
				...project,
				...extras,
			})),
			ctx.db
				.query('projectGallery')
				.withIndex('by_project_sort', (q) =>
					q.eq('projectId', project._id),
				)
				.collect(),
			ctx.db
				.query('projectVersions')
				.withIndex('by_project', (q) => q.eq('projectId', project._id))
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

		if (
			!(await canManageContent(ctx, item, user, {
				allowSiteAdmin: false,
			}))
		) {
			throw new Error(
				'Only the owner or an organization owner/admin can delete this project',
			)
		}

		await deleteProjectFiles(ctx, item)
		await deleteProjectRelatedRows(ctx, args.id)
		await afterProjectWrite(ctx, item, null)
		await ctx.db.delete(args.id)
	},
})

/** Return a fixable submission to draft without lifting a final rejection. */
export const requestChanges = moderatorMutation({
	args: {
		id: v.id('projects'),
		reason: v.string(),
		expectedRevision: v.optional(v.number()),
	},
	returns: v.id('projects'),
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.id)
		if (!item) throw new ConvexError('Project not found')
		assertReviewRevision(item, args.expectedRevision)
		if (
			(item.submissionStatus !== 'pending' &&
				item.status !== 'under_review') ||
			item.moderationStatus === 'rejected'
		) {
			throw new ConvexError(
				'Only submissions awaiting review can be returned for changes',
			)
		}
		if (await isAffiliatedWithContent(ctx, item, ctx.moderator._id)) {
			throw new ConvexError(
				'Ask another admin to review your own project',
			)
		}
		const reason = args.reason.trim()
		if (!reason || reason.length > 500) {
			throw new ConvexError(
				'Explain the required changes in 1 to 500 characters',
			)
		}
		const now = Date.now()
		await ctx.db.patch(item._id, {
			...(hasApprovedListing(item)
				? {}
				: {
						status: 'draft' as const,
						moderationStatus: 'pending' as const,
						moderationReason: reason,
					}),
			...decisionFields(item, 'changes_requested', reason),
			moderatedAt: now,
			moderatedBy: ctx.moderator._id,
			updatedAt: now,
		})
		await afterProjectWrite(ctx, item, await ctx.db.get(item._id))
		await recordAdminAction(ctx, ctx.moderator._id, {
			action: 'project.requestChanges',
			targetType: 'project',
			targetId: item._id,
			targetLabel: item.name,
			changes: { status: 'draft', moderationStatus: 'pending' },
			reason,
		})
		return item._id
	},
})

/** Admin update - toggle status/moderation (no ownership check). */
export const adminUpdate = moderatorMutation({
	args: {
		id: v.id('projects'),
		expectedRevision: v.optional(v.number()),
		status: v.optional(
			v.union(
				v.literal('draft'),
				v.literal('published'),
				v.literal('under_review'),
			),
		),
		moderationStatus: v.optional(projectModerationStatus),
		moderationReason: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = ctx.moderator

		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Project not found')
		}

		assertReviewRevision(item, args.expectedRevision)
		// A rejection is final: the project stays hidden in review and the owner
		// cannot resubmit it (see `update`). Only another admin decision can
		// change it.
		const requestedStatus =
			args.moderationStatus === 'rejected' ? 'under_review' : args.status
		// Unpublishing sends `approved` with `draft`; that is not an approval.
		const isApproval =
			requestedStatus === 'published' ||
			(args.moderationStatus === 'approved' &&
				requestedStatus !== 'draft')
		if (
			isApproval &&
			(await isAffiliatedWithContent(ctx, item, user._id))
		) {
			throw new ConvexError(
				'You cannot approve your own project. Ask another admin to review it.',
			)
		}

		if (
			isApproval &&
			item.submissionRevision !== undefined &&
			!item.publishedAt &&
			item.status !== 'published' &&
			item.submissionStatus !== 'pending'
		)
			throw new ConvexError('Only a submitted revision can be approved')
		const now = Date.now()
		const patch: Record<string, unknown> = {
			updatedAt: now,
			submissionRevision: (item.submissionRevision ?? 0) + 1,
		}
		if (
			args.moderationStatus === 'rejected' ||
			args.moderationStatus === 'flagged' ||
			requestedStatus === 'draft'
		)
			moderationReason(args.moderationReason)
		if (isApproval && item.submissionStatus === 'pending') {
			Object.assign(
				patch,
				item.draftChangesJson
					? snapshotPatch(item, item.draftChangesJson)
					: {},
				decisionFields(item, 'approved'),
				{
					draftChangesJson: undefined,
					publishedGalleryJson: undefined,
				},
			)
			const reviewed = submissionView(item)
			const collision = await ctx.db
				.query('projects')
				.withIndex('by_slug', (q) => q.eq('slug', reviewed.slug))
				.first()
			if (collision && collision._id !== item._id)
				throw new ConvexError(
					'This project name is now in use. Request changes before approving.',
				)
		}
		if (
			args.moderationStatus === 'rejected' &&
			item.submissionStatus === 'pending'
		)
			Object.assign(
				patch,
				decisionFields(
					item,
					'rejected',
					moderationReason(args.moderationReason),
				),
			)
		if (args.moderationStatus === 'flagged' || requestedStatus === 'draft')
			Object.assign(
				patch,
				decisionFields(
					item,
					'changes_requested',
					moderationReason(args.moderationReason),
				),
			)

		if (requestedStatus !== undefined) {
			if (requestedStatus === 'published') {
				await assertProjectHasVersion(ctx, item._id)
			}

			patch.status = requestedStatus
			if (requestedStatus === 'published' && !item.publishedAt) {
				patch.publishedAt = now
			}
			if (args.moderationStatus === undefined) {
				patch.moderationStatus =
					requestedStatus === 'published' ? 'approved' : 'pending'
				patch.moderatedAt = now
				patch.moderatedBy = user._id
				if (requestedStatus === 'published') {
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
			requiresModerationReason(args.moderationStatus) &&
			!args.moderationReason?.trim()
		) {
			throw new Error('A moderation reason is required')
		}
		if (
			requestedStatus === 'published' &&
			(item.submissionStatus === 'pending' ||
				item.submissionRevision === undefined)
		) {
			// Releases submitted with the project are reviewed together with it.
			const pendingReleases = await ctx.db
				.query('projectVersions')
				.withIndex('by_project', (q) => q.eq('projectId', item._id))
				.collect()
			for (const release of pendingReleases) {
				if (
					release.reviewStatus === 'pending' &&
					isValidatedRelease(release) &&
					(!item.submittedVersionIds ||
						item.submittedVersionIds.includes(release._id))
				) {
					await ctx.db.patch(release._id, {
						reviewStatus: 'approved',
						standaloneReviewPending: false,
						reviewedAt: now,
						reviewedBy: user._id,
					})
					await recordReleaseActivity(ctx, item, release)
				}
			}
		}
		if (
			args.moderationStatus === 'rejected' &&
			item.submissionStatus === 'pending' &&
			hasApprovedListing(item)
		) {
			patch.status = item.status
			patch.moderationStatus = item.moderationStatus
			patch.moderationReason = item.moderationReason
		}
		await ctx.db.patch(args.id, patch)
		await afterProjectWrite(ctx, item, await ctx.db.get(args.id))
		await updateProjectReleaseSummary(ctx, args.id)
		await recordAdminAction(ctx, user._id, {
			action: 'project.moderate',
			targetType: 'project',
			targetId: args.id,
			targetLabel: item.name,
			changes: {
				status: requestedStatus,
				moderationStatus: args.moderationStatus,
			},
			reason: args.moderationReason,
		})
		if (
			requestedStatus !== undefined ||
			args.moderationStatus !== undefined
		) {
			const current = await ctx.db.get(args.id)
			const nextStatus = current!.status
			const nextModerationStatus =
				current!.moderationStatus ??
				(requestedStatus !== undefined
					? requestedStatus === 'published'
						? 'approved'
						: 'pending'
					: item.moderationStatus)
			await ctx.scheduler.runAfter(
				0,
				internal.functions.projects.artifactDelivery
					.syncProjectDelivery,
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
export const listPendingModeration = moderatorQuery({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50

		const legacyItems = await ctx.db
			.query('projects')
			.withIndex('by_moderation_status', (q) =>
				q.eq('moderationStatus', 'pending'),
			)
			.take(limit)

		const pending = await ctx.db
			.query('projects')
			.withIndex('by_submission_status', (q) =>
				q.eq('submissionStatus', 'pending'),
			)
			.take(limit)
		const items = [
			...new Map(
				[
					...pending,
					...legacyItems.filter((item) => !item.submissionStatus),
				].map((item) => [item._id, item]),
			).values(),
		].slice(0, limit)
		return Promise.all(
			items.map(async (item) => {
				const iconUrl = await resolveProjectIconUrl(item)

				const owner = await authComponent.getAnyUserById(
					ctx,
					item.createdBy,
				)
				const ownerName =
					((owner as Record<string, unknown> | null)
						?.displayUsername as string | undefined) ??
					((owner as Record<string, unknown> | null)?.username as
						| string
						| undefined) ??
					((owner as Record<string, unknown> | null)?.email as
						| string
						| undefined) ??
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
export const adminRemove = adminMutation({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.id)
		if (!item) {
			throw new Error('Project not found')
		}

		await deleteProjectFiles(ctx, item)
		await deleteProjectRelatedRows(ctx, args.id)
		await afterProjectWrite(ctx, item, null)
		await ctx.db.delete(args.id)
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'project.remove',
			targetType: 'project',
			targetId: args.id,
			targetLabel: item.name,
		})
	},
})
