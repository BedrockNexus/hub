import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from '../../_generated/dataModel'
import { type MutationCtx, query } from '../../_generated/server'
import { isListedServer } from '../../lib/contentVisibility'
import { ownerFromOrganization } from '../../lib/contentOwnership'
import { authedMutation, authedQuery } from '../../lib/functions'
import { ownerDisplayName } from '../../lib/ownerName'
import { canEditContent, getOrganizationRole } from '../../lib/permissions'
import { enforceRateLimit } from '../../lib/rateLimits'
import { toCards } from './listing'

/**
 * Server networks (roadmap Phase 5): several servers run by one owner, shown
 * together on one page with their combined player count. A server can join
 * a network only when both have the same owner.
 */

const MAX_NETWORKS_PER_OWNER = 20
const MAX_SERVERS_PER_NETWORK = 50
const MAX_NAME = 60
const MAX_DESCRIPTION = 500

type Owner = { ownerType: 'user' | 'organization'; ownerId: string }

function cleanName(name: string) {
	const value = name.trim().replace(/\s+/g, ' ')
	if (!value || value.length > MAX_NAME) {
		throw new ConvexError(`Network names are 1 to ${MAX_NAME} characters`)
	}
	return value
}

function cleanWebsite(value: string | undefined) {
	const text = value?.trim()
	if (!text) return undefined
	try {
		const url = new URL(text)
		if (url.protocol === 'https:') return url.toString()
	} catch {
		// Falls through to the error below.
	}
	throw new ConvexError('The website must be a full https:// address')
}

async function allocatePublicId(ctx: MutationCtx) {
	for (let attempt = 0; attempt < 20; attempt++) {
		const code = Array.from({ length: 8 }, () =>
			Math.floor(Math.random() * 36).toString(36),
		).join('')
		const candidate = `n_${code}`
		const existing = await ctx.db
			.query('serverNetworks')
			.withIndex('by_publicId', (q) => q.eq('publicId', candidate))
			.unique()
		if (!existing) return candidate
	}
	throw new ConvexError('Could not create the network. Please try again.')
}

async function requireEditableNetwork(
	ctx: MutationCtx,
	networkId: Id<'serverNetworks'>,
	user: { _id: string; role?: string | null },
) {
	const network = await ctx.db.get(networkId)
	if (
		!network ||
		!(await canEditContent(ctx, network, user, { allowSiteAdmin: true }))
	) {
		throw new ConvexError('Network not found')
	}
	return network
}

function sameOwner(a: Owner, b: Owner) {
	return a.ownerType === b.ownerType && a.ownerId === b.ownerId
}

export const create = authedMutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		website: v.optional(v.string()),
		organizationId: v.optional(v.string()),
	},
	returns: v.object({
		_id: v.id('serverNetworks'),
		publicId: v.string(),
	}),
	handler: async (ctx, args) => {
		await enforceRateLimit(
			ctx,
			'networkCreate',
			ctx.user._id,
			'You have created many networks today. Please try again later.',
		)
		const owner = ownerFromOrganization(args.organizationId, ctx.user._id)
		if (
			owner.ownerType === 'organization' &&
			(await getOrganizationRole(ctx, owner.ownerId, ctx.user._id)) === null
		) {
			throw new ConvexError('You are not a member of that organization')
		}
		const existing = await ctx.db
			.query('serverNetworks')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId),
			)
			.take(MAX_NETWORKS_PER_OWNER)
		if (existing.length >= MAX_NETWORKS_PER_OWNER) {
			throw new ConvexError(
				`An owner can have at most ${MAX_NETWORKS_PER_OWNER} networks`,
			)
		}
		const now = Date.now()
		const publicId = await allocatePublicId(ctx)
		const description = args.description?.trim().slice(0, MAX_DESCRIPTION)
		const _id = await ctx.db.insert('serverNetworks', {
			...owner,
			publicId,
			name: cleanName(args.name),
			description: description || undefined,
			website: cleanWebsite(args.website),
			createdBy: ctx.user._id,
			createdAt: now,
			updatedAt: now,
		})
		return { _id, publicId }
	},
})

export const update = authedMutation({
	args: {
		networkId: v.id('serverNetworks'),
		name: v.string(),
		description: v.optional(v.string()),
		website: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const network = await requireEditableNetwork(ctx, args.networkId, ctx.user)
		const description = args.description?.trim().slice(0, MAX_DESCRIPTION)
		await ctx.db.patch(network._id, {
			name: cleanName(args.name),
			description: description || undefined,
			website: cleanWebsite(args.website),
			updatedAt: Date.now(),
		})
		return null
	},
})

export const remove = authedMutation({
	args: { networkId: v.id('serverNetworks') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const network = await requireEditableNetwork(ctx, args.networkId, ctx.user)
		const servers = await ctx.db
			.query('servers')
			.withIndex('by_networkId', (q) => q.eq('networkId', network._id))
			.take(MAX_SERVERS_PER_NETWORK + 1)
		for (const server of servers) {
			await ctx.db.patch(server._id, { networkId: undefined })
		}
		await ctx.db.delete(network._id)
		return null
	},
})

/** Puts a server in one of its owner's networks, or takes it out (null). */
export const setServerNetwork = authedMutation({
	args: {
		serverId: v.id('servers'),
		networkId: v.union(v.id('serverNetworks'), v.null()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const server = await ctx.db.get(args.serverId)
		if (
			!server ||
			!(await canEditContent(ctx, server, ctx.user, { allowSiteAdmin: true }))
		) {
			throw new ConvexError('Server not found')
		}
		if (args.networkId === null) {
			await ctx.db.patch(server._id, { networkId: undefined })
			return null
		}
		const network = await requireEditableNetwork(ctx, args.networkId, ctx.user)
		if (!sameOwner(network, server)) {
			throw new ConvexError(
				'A server can only join a network with the same owner',
			)
		}
		const members = await ctx.db
			.query('servers')
			.withIndex('by_networkId', (q) => q.eq('networkId', network._id))
			.take(MAX_SERVERS_PER_NETWORK)
		if (
			members.length >= MAX_SERVERS_PER_NETWORK &&
			!members.some((member) => member._id === server._id)
		) {
			throw new ConvexError(
				`A network can have at most ${MAX_SERVERS_PER_NETWORK} servers`,
			)
		}
		await ctx.db.patch(server._id, { networkId: network._id })
		return null
	},
})

/** Networks the caller can manage for one owner (personal or an organization). */
export const listMine = authedQuery({
	args: { organizationId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const owner = ownerFromOrganization(args.organizationId, ctx.user._id)
		if (
			owner.ownerType === 'organization' &&
			(await getOrganizationRole(ctx, owner.ownerId, ctx.user._id)) === null
		) {
			return []
		}
		const networks = await ctx.db
			.query('serverNetworks')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId),
			)
			.take(MAX_NETWORKS_PER_OWNER)
		return Promise.all(
			networks.map(async (network) => ({
				_id: network._id,
				publicId: network.publicId,
				name: network.name,
				description: network.description,
				website: network.website,
				servers: (
					await ctx.db
						.query('servers')
						.withIndex('by_networkId', (q) => q.eq('networkId', network._id))
						.take(MAX_SERVERS_PER_NETWORK)
				).map((server) => ({ _id: server._id, name: server.name })),
			})),
		)
	},
})

/** A network page: its listed servers, as cards, and combined players. */
export const getByRef = query({
	args: { ref: v.string() },
	handler: async (ctx, args) => {
		if (args.ref.length > 64) return null
		const network = await ctx.db
			.query('serverNetworks')
			.withIndex('by_publicId', (q) => q.eq('publicId', args.ref))
			.unique()
		if (!network) return null
		const servers = (
			await ctx.db
				.query('servers')
				.withIndex('by_networkId', (q) => q.eq('networkId', network._id))
				.take(MAX_SERVERS_PER_NETWORK)
		).filter(isListedServer)
		if (servers.length === 0) return null
		const rows = await Promise.all(
			servers.map(async (server: Doc<'servers'>) => ({
				server,
				stats: await ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first(),
				status: await ctx.db
					.query('serverStatus')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.unique(),
			})),
		)
		const cards = await toCards(ctx, rows)
		return {
			publicId: network.publicId,
			name: network.name,
			description: network.description,
			website: network.website,
			ownerName: await ownerDisplayName(ctx, network.ownerType, network.ownerId),
			onlinePlayers: cards.reduce(
				(sum, card) => sum + (card.online ? card.playerCount : 0),
				0,
			),
			servers: cards.sort((a, b) => b.playerCount - a.playerCount),
		}
	},
})
