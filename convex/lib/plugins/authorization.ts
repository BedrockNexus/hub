import { ConvexError } from 'convex/values'

import { components } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { type AppUser, isStaff } from './access'

type DatabaseCtx = QueryCtx | MutationCtx

export type BetterAuthOrganization = {
	_id: string
	name: string
	slug: string
	logo?: string | null
	createdAt: number
}

export type BetterAuthMember = {
	_id: string
	organizationId: string
	userId: string
	role: string
	createdAt: number
}

type AdapterPage<T> = {
	page?: T[]
}

export function getAdapterPage<T>(result: unknown) {
	return ((result as AdapterPage<T> | null)?.page ?? []) as T[]
}

export function normalizeOrganizationRole(role: string) {
	const roles = role.split(',')
	if (roles.includes('owner')) return 'owner' as const
	if (roles.includes('admin')) return 'admin' as const
	return 'member' as const
}

export async function getOrganizationById(
	ctx: DatabaseCtx,
	organizationId: string,
) {
	return (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'organization',
		where: [{ field: '_id', value: organizationId }],
	})) as BetterAuthOrganization | null
}

export async function getOrganizationBySlug(ctx: DatabaseCtx, slug: string) {
	return (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'organization',
		where: [{ field: 'slug', value: slug }],
	})) as BetterAuthOrganization | null
}

export async function listOrganizationMemberships(
	ctx: DatabaseCtx,
	authUserId: string,
	limit = 100,
) {
	const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: 'member',
		where: [{ field: 'userId', value: authUserId }],
		paginationOpts: { cursor: null, numItems: limit },
	})
	return getAdapterPage<BetterAuthMember>(result)
}

export async function listOrganizationMembers(
	ctx: DatabaseCtx,
	organizationId: string,
	limit = 250,
) {
	const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: 'member',
		where: [{ field: 'organizationId', value: organizationId }],
		paginationOpts: { cursor: null, numItems: limit },
	})
	return getAdapterPage<BetterAuthMember>(result)
}

export async function getActiveOrganizationMembership(
	ctx: DatabaseCtx,
	organizationId: string,
	user: AppUser,
) {
	const member = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'member',
		where: [
			{ field: 'organizationId', value: organizationId },
			{ field: 'userId', value: user._id },
		],
	})) as BetterAuthMember | null

	if (!member) {
		return null
	}

	return {
		membershipId: member._id,
		organizationId,
		userId: user._id,
		role: normalizeOrganizationRole(member.role),
		status: 'active' as const,
	}
}

export async function requireOrganizationMember(
	ctx: DatabaseCtx,
	organizationId: string,
	user: AppUser,
) {
	const [organization, membership] = await Promise.all([
		getOrganizationById(ctx, organizationId),
		getActiveOrganizationMembership(ctx, organizationId, user),
	])

	if (!organization || !membership) {
		throw new ConvexError({
			code: 'FORBIDDEN',
			message: 'Active organization membership is required.',
		})
	}

	return membership
}

export async function requireOrganizationManager(
	ctx: DatabaseCtx,
	organizationId: string,
	user: AppUser,
) {
	const organization = await getOrganizationById(ctx, organizationId)
	if (!organization) {
		throw new ConvexError({
			code: 'FORBIDDEN',
			message: 'Organization owner or admin access is required.',
		})
	}

	if (isStaff(user)) {
		return {
			membershipId: 'staff',
			organizationId,
			userId: user._id,
			role: 'admin' as const,
			status: 'active' as const,
		}
	}

	const membership = await getActiveOrganizationMembership(
		ctx,
		organizationId,
		user,
	)

	if (!membership || membership.role === 'member') {
		throw new ConvexError({
			code: 'FORBIDDEN',
			message: 'Organization owner or admin access is required.',
		})
	}

	return membership
}

export async function canViewProject(
	ctx: DatabaseCtx,
	project: Doc<'plugins'>,
	user: AppUser | null,
) {
	if (
		project.status === 'published' &&
		(project.visibility === 'public' || project.visibility === 'unlisted')
	) {
		return true
	}

	if (!user) {
		return false
	}

	if (isStaff(user)) {
		return true
	}

	if (project.visibility === 'hidden' || project.visibility === 'suspended') {
		return false
	}

	if (project.ownerType === 'user') {
		return project.ownerId === user._id
	}

	return Boolean(
		await getActiveOrganizationMembership(ctx, project.ownerId, user),
	)
}

export async function requireProjectManager(
	ctx: DatabaseCtx,
	project: Doc<'plugins'>,
	user: AppUser,
) {
	if (isStaff(user)) {
		return { kind: 'staff' as const, user }
	}

	if (project.ownerType === 'user' && project.ownerId === user._id) {
		return { kind: 'owner' as const, user }
	}

	if (project.ownerType === 'organization') {
		const membership = await requireOrganizationManager(
			ctx,
			project.ownerId,
			user,
		)
		return { kind: 'organization' as const, user, membership }
	}

	throw new ConvexError({
		code: 'FORBIDDEN',
		message: 'Plugin owner or organization manager access is required.',
	})
}
