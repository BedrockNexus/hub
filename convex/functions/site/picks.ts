import { v } from 'convex/values'
import type { Doc, Id } from '../../_generated/dataModel'
import { type MutationCtx, type QueryCtx, query } from '../../_generated/server'
import { recordAdminAction } from '../../lib/audit'
import { isPublicProject, isPublicServer } from '../../lib/contentVisibility'
import { adminMutation, adminQuery } from '../../lib/functions'
import { toCards as toProjectCards } from '../projects/listing'
import {
	statsOf,
	statusOf,
	toCards as toServerCards,
} from '../servers/listing'

/**
 * Bedrock Nexus Picks: servers and projects an admin chose to highlight, each
 * with a public note saying why.
 *
 * Picks are editorial. They appear only in places labelled as picks and are
 * never read by trending, search, listings or creator ranks, and they can
 * never be bought. Every change is written to the admin audit log.
 */

const NOTE_MAX_LENGTH = 200
const PUBLIC_LIMIT = 48
const ADMIN_LIMIT = 200

const targetTypeValidator = v.union(v.literal('server'), v.literal('project'))

function cleanNote(value: string) {
	const note = value.trim().replace(/\s+/g, ' ')
	if (!note) {
		throw new Error('Say in a sentence why this is a pick')
	}
	if (note.length > NOTE_MAX_LENGTH) {
		throw new Error(`Keep the note under ${NOTE_MAX_LENGTH} characters`)
	}
	return note
}

async function targetOf(ctx: QueryCtx, pick: Doc<'picks'>) {
	if (pick.targetType === 'server' && pick.serverId) {
		const server = await ctx.db.get('servers', pick.serverId)
		return server
			? { server, isPublic: isPublicServer(server) }
			: null
	}
	if (pick.targetType === 'project' && pick.projectId) {
		const project = await ctx.db.get('projects', pick.projectId)
		return project
			? { project, isPublic: isPublicProject(project) }
			: null
	}
	return null
}

/** Current picks that are still public, newest first. */
export const list = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = Math.min(
			Math.max(Math.floor(args.limit ?? PUBLIC_LIMIT), 1),
			PUBLIC_LIMIT,
		)
		const picks = await ctx.db
			.query('picks')
			.withIndex('by_pickedAt')
			.order('desc')
			// Room for picks whose target is no longer public.
			.take(limit * 2)
		const shown = (
			await Promise.all(
				picks.map(async (pick) => {
					const target = await targetOf(ctx, pick)
					return target?.isPublic ? { pick, target } : null
				}),
			)
		)
			.flatMap((entry) => (entry ? [entry] : []))
			.slice(0, limit)

		return await Promise.all(
			shown.map(async ({ pick, target }) => {
				const base = {
					_id: pick._id,
					note: pick.note,
					pickedAt: pick.pickedAt,
				}
				if ('server' in target && target.server) {
					const { server } = target
					const [card] = await toServerCards(ctx, [
						{
							server,
							stats: await statsOf(ctx, server._id),
							status: await statusOf(ctx, server._id),
						},
					])
					return { ...base, targetType: 'server' as const, server: card }
				}
				const { project } = target as { project: Doc<'projects'> }
				const [card] = await toProjectCards(ctx, [
					{
						project,
						stats: await ctx.db
							.query('projectStats')
							.withIndex('by_project', (q) =>
								q.eq('projectId', project._id),
							)
							.first(),
					},
				])
				return { ...base, targetType: 'project' as const, project: card }
			}),
		)
	},
})

/** Every pick, including ones whose target is hidden or gone. */
export const listAdmin = adminQuery({
	args: {},
	handler: async (ctx) => {
		const picks = await ctx.db
			.query('picks')
			.withIndex('by_pickedAt')
			.order('desc')
			.take(ADMIN_LIMIT)
		return await Promise.all(
			picks.map(async (pick) => {
				const target = await targetOf(ctx, pick)
				const doc =
					target && 'server' in target ? target.server : target?.project
				return {
					_id: pick._id,
					targetType: pick.targetType,
					note: pick.note,
					pickedAt: pick.pickedAt,
					name: doc?.name ?? 'Deleted',
					slug: doc?.slug,
					isPublic: target?.isPublic ?? false,
				}
			}),
		)
	},
})

async function findTarget(
	ctx: MutationCtx,
	targetType: Doc<'picks'>['targetType'],
	slug: string,
) {
	const target =
		targetType === 'server'
			? await ctx.db
					.query('servers')
					.withIndex('by_slug', (q) => q.eq('slug', slug))
					.first()
			: await ctx.db
					.query('projects')
					.withIndex('by_slug', (q) => q.eq('slug', slug))
					.first()
	if (!target) {
		throw new Error(`No ${targetType} has the address "${slug}"`)
	}
	return target
}

async function existingPick(
	ctx: MutationCtx,
	targetType: Doc<'picks'>['targetType'],
	targetId: Id<'servers'> | Id<'projects'>,
) {
	return targetType === 'server'
		? await ctx.db
				.query('picks')
				.withIndex('by_serverId', (q) =>
					q.eq('serverId', targetId as Id<'servers'>),
				)
				.first()
		: await ctx.db
				.query('picks')
				.withIndex('by_projectId', (q) =>
					q.eq('projectId', targetId as Id<'projects'>),
				)
				.first()
}

/** Picks a public server or project, found by the last part of its URL. */
export const add = adminMutation({
	args: {
		targetType: targetTypeValidator,
		slug: v.string(),
		note: v.string(),
	},
	returns: v.id('picks'),
	handler: async (ctx, args) => {
		const note = cleanNote(args.note)
		const target = await findTarget(
			ctx,
			args.targetType,
			args.slug.trim().toLowerCase(),
		)
		const isPublic =
			args.targetType === 'server'
				? isPublicServer(target as Doc<'servers'>)
				: isPublicProject(target as Doc<'projects'>)
		if (!isPublic) {
			throw new Error('Only something that is public can be a pick')
		}
		if (await existingPick(ctx, args.targetType, target._id)) {
			throw new Error('That is already a pick')
		}
		const pickId = await ctx.db.insert('picks', {
			targetType: args.targetType,
			...(args.targetType === 'server'
				? { serverId: target._id as Id<'servers'> }
				: { projectId: target._id as Id<'projects'> }),
			note,
			pickedBy: ctx.admin._id,
			pickedAt: Date.now(),
		})
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pick.add',
			targetType: 'pick',
			targetId: pickId,
			targetLabel: target.name,
			changes: { type: args.targetType, slug: target.slug, note },
		})
		return pickId
	},
})

export const updateNote = adminMutation({
	args: { id: v.id('picks'), note: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const pick = await ctx.db.get('picks', args.id)
		if (!pick) {
			throw new Error('Pick not found')
		}
		const note = cleanNote(args.note)
		if (note !== pick.note) {
			await ctx.db.patch('picks', pick._id, { note })
			await recordAdminAction(ctx, ctx.admin._id, {
				action: 'pick.update',
				targetType: 'pick',
				targetId: pick._id,
				changes: { note },
			})
		}
		return null
	},
})

export const remove = adminMutation({
	args: { id: v.id('picks') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const pick = await ctx.db.get('picks', args.id)
		if (!pick) {
			return null
		}
		await ctx.db.delete('picks', pick._id)
		await recordAdminAction(ctx, ctx.admin._id, {
			action: 'pick.remove',
			targetType: 'pick',
			targetId: pick._id,
			changes: {
				type: pick.targetType,
				target: pick.serverId ?? pick.projectId,
				note: pick.note,
			},
		})
		return null
	},
})

/** Call when a server or project is deleted, so no pick points at nothing. */
export async function removePicksFor(
	ctx: MutationCtx,
	target: { serverId: Id<'servers'> } | { projectId: Id<'projects'> },
) {
	const picks =
		'serverId' in target
			? await ctx.db
					.query('picks')
					.withIndex('by_serverId', (q) =>
						q.eq('serverId', target.serverId),
					)
					.take(10)
			: await ctx.db
					.query('picks')
					.withIndex('by_projectId', (q) =>
						q.eq('projectId', target.projectId),
					)
					.take(10)
	for (const pick of picks) {
		await ctx.db.delete('picks', pick._id)
	}
}
