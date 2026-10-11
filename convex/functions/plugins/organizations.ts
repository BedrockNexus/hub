import { v } from 'convex/values'

import { authedQuery } from '../../lib/functions'
import {
	getOrganizationBySlug,
	requireOrganizationManager,
	requireOrganizationMember,
} from '../../lib/plugins/authorization'
import { getProjectDownloadCount } from '../../lib/plugins/downloadCounts'
import {
	organizationRoleValidator,
	projectStatusValidator,
	projectVisibilityValidator,
} from '../../schemas/plugins'

/**
 * What an organization's members can see and do in the plugin registry.
 * Organizations themselves (members, invitations, profile) are managed by the
 * hub dashboard; this module only answers plugin-specific questions.
 */

const membershipAccessValidator = v.object({
	authorized: v.literal(true),
	role: organizationRoleValidator,
	status: v.literal('active'),
})

const organizationPluginValidator = v.object({
	projectId: v.id('plugins'),
	slug: v.string(),
	name: v.string(),
	summary: v.string(),
	visibility: projectVisibilityValidator,
	status: projectStatusValidator,
	downloadCount: v.number(),
})

export const getMembershipAccess = authedQuery({
	args: { organizationId: v.string() },
	returns: membershipAccessValidator,
	handler: async (ctx, args) => {
		const membership = await requireOrganizationMember(
			ctx,
			args.organizationId,
			ctx.user,
		)
		return {
			authorized: true as const,
			role: membership.role,
			status: 'active' as const,
		}
	},
})

/** Throws unless the caller may connect GitHub and publish for the organization. */
export const getManagementAccess = authedQuery({
	args: { organizationId: v.string() },
	returns: membershipAccessValidator,
	handler: async (ctx, args) => {
		const membership = await requireOrganizationManager(
			ctx,
			args.organizationId,
			ctx.user,
		)
		return {
			authorized: true as const,
			role: membership.role,
			status: 'active' as const,
		}
	},
})

/**
 * The ID of an organization the caller may connect GitHub for, or null when
 * no organization has that slug. Throws for members who are not managers.
 */
export const getManagedIdBySlug = authedQuery({
	args: { slug: v.string() },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		const organization = await getOrganizationBySlug(ctx, args.slug)
		if (!organization) {
			return null
		}
		await requireOrganizationManager(ctx, organization._id, ctx.user)
		return organization._id
	},
})

/** Every plugin the organization owns, in any state, for its members. */
export const listPlugins = authedQuery({
	args: { organizationId: v.string() },
	returns: v.array(organizationPluginValidator),
	handler: async (ctx, args) => {
		await requireOrganizationMember(ctx, args.organizationId, ctx.user)

		const projects = await ctx.db
			.query('plugins')
			.withIndex('by_owner_type_and_owner_id', (index) =>
				index
					.eq('ownerType', 'organization')
					.eq('ownerId', args.organizationId),
			)
			.order('desc')
			.take(250)
		const downloadCounts = await Promise.all(
			projects.map((project) => getProjectDownloadCount(ctx, project)),
		)

		return projects.map((project, index) => ({
			projectId: project._id,
			slug: project.slug,
			name: project.name,
			summary: project.summary,
			visibility: project.visibility,
			status: project.status,
			downloadCount: downloadCounts[index] ?? project.downloadCount,
		}))
	},
})
