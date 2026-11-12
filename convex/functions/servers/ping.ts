import { v } from 'convex/values'
import { query } from '../../_generated/server'
import { isPublicServer } from '../../lib/contentVisibility'
import { resolveCdnObjectUrl } from '../../lib/r2'
import {
	normalizeServerAddress,
	ServerAddressError,
} from '../../lib/serverAddress'

const LOGO_URL_EXPIRES_IN = 60 * 60 * 24
const UPTIME_DAYS = 7

/**
 * The public BedrockNexus listing for an address, if there is one, so Server
 * Ping can link to it: its latest check and how often it was up each day.
 */
export const findListing = query({
	args: { host: v.string(), port: v.number() },
	returns: v.union(
		v.null(),
		v.object({
			name: v.string(),
			reference: v.string(),
			logoUrl: v.optional(v.string()),
			lastOnline: v.optional(v.number()),
			days: v.array(
				v.object({
					dayKey: v.string(),
					/** Share of checks that found it online, 0 to 1. */
					uptime: v.number(),
				}),
			),
		}),
	),
	handler: async (ctx, args) => {
		let address: ReturnType<typeof normalizeServerAddress>
		try {
			address = normalizeServerAddress(args.host, args.port)
		} catch (error) {
			if (error instanceof ServerAddressError) return null
			throw error
		}
		const server =
			(await ctx.db
				.query('servers')
				.withIndex('by_address_key', (q) => q.eq('addressKey', address.key))
				.first()) ??
			// Listings saved before addressKey was filled in.
			(await ctx.db
				.query('servers')
				.withIndex('by_ipAddress_and_port', (q) =>
					q.eq('ipAddress', address.host).eq('port', address.port),
				)
				.first())
		if (
			!server ||
			!isPublicServer(server) ||
			server.moderationStatus === 'flagged' ||
			server.moderationStatus === 'rejected'
		) {
			return null
		}
		const status = await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', server._id))
			.first()
		const days = await ctx.db
			.query('serverDailyStats')
			.withIndex('by_serverId_and_dayKey', (q) =>
				q.eq('serverId', server._id),
			)
			.order('desc')
			.take(UPTIME_DAYS)
		return {
			name: server.name,
			reference:
				address.port === 19_132 ? address.host : address.key,
			logoUrl: server.logoR2Key
				? await resolveCdnObjectUrl(server.logoR2Key, LOGO_URL_EXPIRES_IN)
				: undefined,
			lastOnline: status?.lastOnline,
			days: days
				.filter((day) => day.checks > 0)
				.map((day) => ({
					dayKey: day.dayKey,
					uptime: day.checksOnline / day.checks,
				}))
				.reverse(),
		}
	},
})
