import { ConvexError, v } from 'convex/values'

import type { Doc } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { query } from '../../_generated/server'
import { type AppUser, getCurrentUserOrNull } from '../../lib/plugins/access'
import { authedQuery } from '../../lib/functions'
import {
	canViewProject,
	getOrganizationById,
	listOrganizationMemberships,
	requireProjectManager,
} from '../../lib/plugins/authorization'
import { getProjectDownloadCount } from '../../lib/plugins/downloadCounts'
import {
	projectStatusValidator,
	projectValidator,
	projectVisibilityValidator,
} from '../../schemas/plugins'

const dashboardProjectValidator = v.object({
	projectId: v.id('plugins'),
	slug: v.string(),
	name: v.string(),
	summary: v.string(),
	visibility: projectVisibilityValidator,
	status: projectStatusValidator,
	downloadCount: v.number(),
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
	const [organization, repository, software, latestVersion, downloadCount] =
		await Promise.all([
			project.ownerType === 'organization'
				? getOrganizationById(ctx, project.ownerId)
				: null,
			ctx.db.get('githubRepositories', project.repositoryId),
			ctx.db.get('serverSoftware', project.softwareId),
			project.latestVersionId
				? ctx.db.get('pluginVersions', project.latestVersionId)
				: null,
			getProjectDownloadCount(ctx, project),
		])

	return {
		projectId: project._id,
		slug: project.slug,
		name: project.name,
		summary: project.summary,
		visibility: project.visibility,
		status: project.status,
		downloadCount,
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
	returns: v.union(projectValidator, v.null()),
	handler: async (ctx, args) => {
		const project = await ctx.db
			.query('plugins')
			.withIndex('by_slug', (index) => index.eq('slug', args.slug))
			.unique()

		if (!project) {
			return null
		}

		const user = await getCurrentUserOrNull(ctx)
		return (await canViewProject(ctx, project, user)) ? project : null
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
				message: 'Project not found.',
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
