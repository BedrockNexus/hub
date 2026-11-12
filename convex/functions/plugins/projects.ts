import { submissionStatus } from '../../schemas/submissions'
import { snapshotPatch } from '../../lib/submissions'
import { moderationStatus } from '../../schemas/projects'
import { resolvePluginReference } from '../../lib/contentReferences'
import { ConvexError, v } from 'convex/values'
import schema from '../../schema'
import { MAX_GALLERY_IMAGES } from '../../lib/gallery'
import { resolveCdnObjectUrl } from '../../lib/r2'
import { ownerDisplayName } from '../../lib/ownerName'

import type { Doc } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { query } from '../../_generated/server'
import { type AppUser, getCurrentUserOrNull } from '../../lib/plugins/access'
import { authedQuery, moderatorQuery } from '../../lib/functions'
import {
	canViewProject,
	getOrganizationById,
	listOrganizationMemberships,
	requireProjectManager,
} from '../../lib/plugins/authorization'
import {
	projectStatusValidator,
	releaseStatusValidator,
	projectValidator,
	publicProjectValidator,
	projectVisibilityValidator,
} from '../../schemas/plugins'

const dashboardProjectValidator = v.object({
	projectId: v.id('plugins'),
	slug: v.string(),
	name: v.string(),
	summary: v.string(),
	visibility: projectVisibilityValidator,
	status: projectStatusValidator,
	moderationStatus: v.optional(moderationStatus),
	submissionStatus: v.optional(submissionStatus),
	submissionReason: v.optional(v.string()),
	moderationReason: v.optional(v.string()),
	hasDraftChanges: v.boolean(),
	updatedAt: v.number(),
	owner: v.union(
		v.object({
			kind: v.literal('personal'),
			name: v.string(),
		}),
		v.object({
			kind: v.literal('organization'),
			name: v.string(),
			slug: v.string(),
		}),
	),
	repository: v.union(
		v.object({
			fullName: v.string(),
			htmlUrl: v.string(),
		}),
		v.null(),
	),
	software: v.union(
		v.object({
			name: v.string(),
			slug: v.string(),
		}),
		v.null(),
	),
	latestVersion: v.union(
		v.object({
			version: v.string(),
			publishedAt: v.optional(v.number()),
		}),
		v.null(),
	),
})

async function hydrateDashboardProject(
	ctx: QueryCtx,
	project: Doc<'plugins'>,
	currentUser: AppUser,
) {
	const [organization, repository, software, latestVersion] =
		await Promise.all([
			project.ownerType === 'organization'
				? getOrganizationById(ctx, project.ownerId)
				: null,
			ctx.db.get('githubRepositories', project.repositoryId),
			ctx.db.get('serverSoftware', project.softwareId),
			project.latestVersionId
				? ctx.db.get('pluginVersions', project.latestVersionId)
				: null,
		])

	return {
		projectId: project._id,
		slug: project.slug,
		name: project.name,
		summary: project.summary,
		visibility: project.visibility,
		status: project.status,
		moderationStatus: project.moderationStatus,
		submissionStatus: project.submissionStatus,
		submissionReason: project.submissionReason,
		moderationReason: project.moderationReason,
		hasDraftChanges: !!project.draftChangesJson,
		updatedAt: project.updatedAt,
		owner:
			project.ownerType === 'organization' && organization
				? ({
						kind: 'organization',
						name: organization.name,
						slug: organization.slug,
					} as const)
				: ({
						kind: 'personal',
						name: currentUser.name,
					} as const),
		repository: repository
			? {
					fullName: repository.fullName,
					htmlUrl: repository.htmlUrl,
				}
			: null,
		software: software
			? {
					name: software.name,
					slug: software.slug,
				}
			: null,
		latestVersion:
			latestVersion?.status === 'published'
				? {
						version: latestVersion.version,
						publishedAt: latestVersion.publishedAt,
					}
				: null,
	}
}

export const getBySlug = query({
	args: { slug: v.string() },
	returns: v.union(publicProjectValidator, v.null()),
	handler: async (ctx, args) => {
		const project = await resolvePluginReference(ctx, args.slug)

		if (!project) {
			return null
		}

		const user = await getCurrentUserOrNull(ctx)
		if (!(await canViewProject(ctx, project, user))) {
			return null
		}
		const {
			ownerId: _ownerId,
			createdBy: _createdBy,
			searchText: _searchText,
			downloadCounterReadyAt: _downloadCounterReadyAt,
			downloadCountRefreshScheduledAt: _downloadCountRefreshScheduledAt,
			submissionStatus: _submissionStatus,
			submissionRevision: _submissionRevision,
			submissionReason: _submissionReason,
			submittedAt: _submittedAt,
			draftChangesJson: _draftChangesJson,
			publishedGalleryJson: _publishedGalleryJson,
			...visible
		} = project
		return visible
	},
})

export const getManagementAccess = authedQuery({
	args: { projectId: v.id('plugins') },
	returns: v.object({
		authorized: v.literal(true),
		kind: v.union(
			v.literal('owner'),
			v.literal('organization'),
			v.literal('staff'),
		),
	}),
	handler: async (ctx, args) => {
		const project = await ctx.db.get('plugins', args.projectId)

		if (!project) {
			throw new ConvexError({
				code: 'NOT_FOUND',
				message: 'Plugin not found.',
			})
		}

		const access = await requireProjectManager(ctx, project, ctx.user)

		return {
			authorized: true as const,
			kind: access.kind,
		}
	},
})

export const listMine = authedQuery({
	args: {},
	returns: v.array(dashboardProjectValidator),
	handler: async (ctx) => {
		const [personalProjects, memberships] = await Promise.all([
			ctx.db
				.query('plugins')
				.withIndex('by_owner_type_and_owner_id', (index) =>
					index.eq('ownerType', 'user').eq('ownerId', ctx.user._id),
				)
				.order('desc')
				.take(100),
			listOrganizationMemberships(ctx, ctx.user._id),
		])
		const organizationProjects = await Promise.all(
			memberships.map((membership) =>
				ctx.db
					.query('plugins')
					.withIndex('by_owner_type_and_owner_id', (index) =>
						index
							.eq('ownerType', 'organization')
							.eq('ownerId', membership.organizationId),
					)
					.order('desc')
					.take(50),
			),
		)
		const projects = new Map(
			[...personalProjects, ...organizationProjects.flat()].map(
				(project) => [project._id, project],
			),
		)
		const hydrated = await Promise.all(
			[...projects.values()].map((project) =>
				hydrateDashboardProject(ctx, project, ctx.user),
			),
		)

		return hydrated.sort((left, right) => right.updatedAt - left.updatedAt)
	},
})

const adminPluginValidator = v.object({
	projectId: v.id('plugins'),
	name: v.string(),
	slug: v.string(),
	status: projectStatusValidator,
	visibility: projectVisibilityValidator,
	moderationStatus: v.optional(moderationStatus),
	moderationReason: v.optional(v.string()),
	software: v.string(),
	repository: v.string(),
	latestVersion: v.optional(v.string()),
	reviewStatus: v.union(releaseStatusValidator, v.literal('notSubmitted')),
	reviewVersion: v.optional(v.string()),
	downloadCount: v.number(),
	updatedAt: v.number(),
	submissionStatus: v.optional(submissionStatus),
	submittedAt: v.optional(v.number()),
	publishedAt: v.optional(v.number()),
	iconUrl: v.optional(v.string()),
	ownerName: v.optional(v.string()),
})

export const listAdmin = moderatorQuery({
	args: {},
	returns: v.array(adminPluginValidator),
	handler: async (ctx) => {
		const projects = await ctx.db.query('plugins').order('desc').take(250)
		return await Promise.all(
			projects.map(async (project) => {
				const [software, repository, version, latestRelease] =
					await Promise.all([
						ctx.db.get('serverSoftware', project.softwareId),
						ctx.db.get('githubRepositories', project.repositoryId),
						project.latestVersionId
							? ctx.db.get(
									'pluginVersions',
									project.latestVersionId,
								)
							: null,
						ctx.db
							.query('pluginReleases')
							.withIndex('by_project_id', (q) =>
								q.eq('projectId', project._id),
							)
							.order('desc')
							.first(),
					])
				return {
					projectId: project._id,
					name: project.name,
					slug: project.slug,
					status: project.status,
					visibility: project.visibility,
					software: software?.name ?? 'Unknown',
					repository: repository?.fullName ?? 'Unavailable',
					moderationStatus: project.moderationStatus,
					moderationReason: project.moderationReason,
					latestVersion: version?.version,
					reviewStatus:
						latestRelease?.status ?? ('notSubmitted' as const),
					reviewVersion: latestRelease?.version,
					downloadCount: project.downloadCount,
					updatedAt: project.updatedAt,
					submissionStatus: project.submissionStatus,
					submittedAt: project.submittedAt,
					publishedAt: project.publishedAt,
					iconUrl: project.iconUrl,
					ownerName: await ownerDisplayName(
						ctx,
						project.ownerType,
						project.ownerId,
					),
				}
			}),
		)
	},
})

/** A single plugin's submission and release history, including private drafts. */
export const getAdminReview = moderatorQuery({
	args: { id: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			project: schema.doc('plugins'),
			categories: v.array(schema.doc('pluginCategories')),
			draft: v.union(schema.doc('pluginPublishingDrafts'), v.null()),
			repository: v.union(schema.doc('githubRepositories'), v.null()),
			software: v.union(schema.doc('serverSoftware'), v.null()),
			releases: v.array(
				schema
					.doc('pluginReleases')
					.extend({ logsUrl: v.optional(v.string()) }),
			),
			gallery: v.array(
				v.object({
					_id: v.id('pluginGallery'),
					caption: v.optional(v.string()),
					fileName: v.string(),
					url: v.string(),
				}),
			),
		}),
	),
	handler: async (ctx, args) => {
		const id = ctx.db.normalizeId('plugins', args.id)
		const project = id ? await ctx.db.get('plugins', id) : null
		if (!project) {
			return null
		}
		const [draft, repository, software, releases, images] =
			await Promise.all([
				ctx.db
					.query('pluginPublishingDrafts')
					.withIndex('by_project_id', (q) =>
						q.eq('projectId', project._id),
					)
					.first(),
				ctx.db.get('githubRepositories', project.repositoryId),
				ctx.db.get('serverSoftware', project.softwareId),
				ctx.db
					.query('pluginReleases')
					.withIndex('by_project_id', (q) =>
						q.eq('projectId', project._id),
					)
					.order('desc')
					.take(100),
				ctx.db
					.query('pluginGallery')
					.withIndex('by_plugin_sort', (q) =>
						q.eq('pluginId', project._id),
					)
					.take(MAX_GALLERY_IMAGES),
			])
		const [gallery, releaseDetails] = await Promise.all([
			Promise.all(
				images.map(async (image) => ({
					_id: image._id,
					caption: image.caption,
					fileName: image.fileName,
					url: await resolveCdnObjectUrl(image.r2Key, 60 * 60),
				})),
			),
			Promise.all(
				releases.map(async (release) => {
					const build = await ctx.db.get(
						'pluginBuilds',
						release.buildId,
					)
					return { ...release, logsUrl: build?.logsUrl }
				}),
			),
		])
		const submitted = releases.find((release) =>
			['preparing', 'inReview', 'publishing'].includes(release.status),
		)
		const reviewedDraft =
			draft && submitted?.submittedDetailsJson
				? {
						...draft,
						...snapshotPatch(draft, submitted.submittedDetailsJson),
					}
				: draft
		const categories = (
			await Promise.all(
				(reviewedDraft?.categoryIds ?? project.categoryIds ?? []).map(
					(id) => ctx.db.get('pluginCategories', id),
				),
			)
		).filter(
			(category): category is Doc<'pluginCategories'> =>
				category !== null,
		)

		return {
			project,
			categories,
			draft: reviewedDraft,
			repository,
			software,
			gallery,
			releases: releaseDetails,
		}
	},
})
