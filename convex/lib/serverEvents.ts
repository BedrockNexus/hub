import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isPublicServer } from './contentVisibility'
import { deliverNotification, getPreferences } from './notifications'
import { ownerRecipients } from './ownerRecipients'

/**
 * Server intelligence (roadmap Phase 5): what each status check means.
 * Called from servers/status.ts internalUpdateStatus for every check.
 *
 * - An incident opens after OFFLINE_AFTER_FAILURES failed checks in a row
 *   (about 15 minutes at one check every 5), dated from the first failure, so
 *   a single dropped ping is never an outage. The next successful check
 *   closes it with its duration.
 * - A version change is recorded when an online check reports a different
 *   version than the last online check.
 * - A player record is recorded when the count beats the highest ever seen,
 *   at most once a day; later records that day update the same event.
 *
 * Owners of public servers are told about incidents opening and closing
 * (notification kinds `server_offline` / `server_online`), and emailed right
 * away unless they turned instant alert emails off.
 */

export const OFFLINE_AFTER_FAILURES = 3
const HOUR_MS = 60 * 60 * 1000
const RECORD_EVENT_GAP_MS = 24 * HOUR_MS
// Records below this are noise from a handful of players.
const MIN_RECORD_PLAYERS = 5

export interface StatusCheck {
	online: boolean
	playerCount: number
	latency?: number
	version?: string
	checkedAt: number
}

type StatusDoc = Doc<'serverStatus'>

/** Adds the check to its hour's totals. */
export async function recordServerHour(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
	check: StatusCheck,
) {
	const hourStart = Math.floor(check.checkedAt / HOUR_MS) * HOUR_MS
	const players = check.online ? check.playerCount : 0
	const hasLatency = check.online && check.latency !== undefined
	const row = await ctx.db
		.query('serverHourlyStats')
		.withIndex('by_serverId_and_hourStart', (q) =>
			q.eq('serverId', serverId).eq('hourStart', hourStart),
		)
		.unique()
	if (row) {
		await ctx.db.patch(row._id, {
			checks: row.checks + 1,
			checksOnline: row.checksOnline + (check.online ? 1 : 0),
			playerSum: row.playerSum + players,
			peakPlayers: Math.max(row.peakPlayers, players),
			latencySum: row.latencySum + (hasLatency ? (check.latency ?? 0) : 0),
			latencySamples: row.latencySamples + (hasLatency ? 1 : 0),
		})
		return
	}
	await ctx.db.insert('serverHourlyStats', {
		serverId,
		hourStart,
		checks: 1,
		checksOnline: check.online ? 1 : 0,
		playerSum: players,
		peakPlayers: players,
		latencySum: hasLatency ? (check.latency ?? 0) : 0,
		latencySamples: hasLatency ? 1 : 0,
	})
}

/**
 * Detects events from one check. Returns the incident fields to store on
 * the server's status document with the rest of the check.
 */
export async function detectServerEvents(
	ctx: MutationCtx,
	server: Doc<'servers'>,
	previous: StatusDoc | null,
	check: StatusCheck,
): Promise<
	Pick<
		StatusDoc,
		| 'failingSince'
		| 'consecutiveFailures'
		| 'incidentOpenSince'
		| 'peakPlayersEver'
		| 'lastRecordEventAt'
	>
> {
	const next = {
		failingSince: previous?.failingSince,
		consecutiveFailures: previous?.consecutiveFailures ?? 0,
		incidentOpenSince: previous?.incidentOpenSince,
		peakPlayersEver: previous?.peakPlayersEver,
		lastRecordEventAt: previous?.lastRecordEventAt,
	}

	if (!check.online) {
		next.consecutiveFailures += 1
		next.failingSince ??= check.checkedAt
		if (
			next.consecutiveFailures >= OFFLINE_AFTER_FAILURES &&
			next.incidentOpenSince === undefined &&
			// A server never seen online has no outage to report.
			previous?.lastOnline !== undefined
		) {
			next.incidentOpenSince = next.failingSince
			await ctx.db.insert('serverEvents', {
				serverId: server._id,
				kind: 'offline',
				at: next.incidentOpenSince,
			})
			await alertOwners(ctx, server, 'server_offline', next.incidentOpenSince)
		}
		return next
	}

	if (next.incidentOpenSince !== undefined) {
		const durationMs = check.checkedAt - next.incidentOpenSince
		await ctx.db.insert('serverEvents', {
			serverId: server._id,
			kind: 'online',
			at: check.checkedAt,
			durationMs,
		})
		await alertOwners(ctx, server, 'server_online', check.checkedAt, durationMs)
	}
	next.consecutiveFailures = 0
	next.failingSince = undefined
	next.incidentOpenSince = undefined

	if (
		previous?.version &&
		check.version &&
		previous.version !== check.version
	) {
		await ctx.db.insert('serverEvents', {
			serverId: server._id,
			kind: 'version_changed',
			at: check.checkedAt,
			fromVersion: previous.version.slice(0, 40),
			toVersion: check.version.slice(0, 40),
		})
	}

	const players = check.playerCount
	if (next.peakPlayersEver === undefined) {
		// First check since records began: a baseline, not a record.
		next.peakPlayersEver = players
	} else if (players > next.peakPlayersEver) {
		next.peakPlayersEver = players
		if (players >= MIN_RECORD_PLAYERS) {
			const recent =
				next.lastRecordEventAt !== undefined &&
				check.checkedAt - next.lastRecordEventAt < RECORD_EVENT_GAP_MS
			const latest = recent
				? await ctx.db
						.query('serverEvents')
						.withIndex('by_serverId_and_at', (q) =>
							q.eq('serverId', server._id).gte('at', next.lastRecordEventAt ?? 0),
						)
						.filter((q) => q.eq(q.field('kind'), 'player_record'))
						.first()
				: null
			if (latest) {
				await ctx.db.patch(latest._id, { players })
			} else {
				await ctx.db.insert('serverEvents', {
					serverId: server._id,
					kind: 'player_record',
					at: check.checkedAt,
					players,
				})
				next.lastRecordEventAt = check.checkedAt
			}
		}
	}
	return next
}

async function alertOwners(
	ctx: MutationCtx,
	server: Doc<'servers'>,
	kind: 'server_offline' | 'server_online',
	at: number,
	durationMs?: number,
) {
	if (!isPublicServer(server)) return
	// Flapping servers alert at most once an hour per kind.
	const key = `${kind}:${server._id}:${Math.floor(at / HOUR_MS)}`
	for (const userId of await ownerRecipients(ctx, server)) {
		const preferences = await getPreferences(ctx, userId)
		const delivered = await deliverNotification(
			ctx,
			userId,
			{ key, kind, subjectType: 'server', subjectId: server._id },
			preferences,
		)
		if (delivered && preferences?.instantAlertEmails !== false) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.social.alerts.sendServerAlert,
				{ userId, serverId: server._id, kind, at, durationMs },
			)
		}
	}
}
