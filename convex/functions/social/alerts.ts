import { Resend } from '@convex-dev/resend'
import { render } from '@react-email/render'
import { v } from 'convex/values'
import { EmailTemplate } from '../../../components/email/email-template'
import { serverHref } from '../../../lib/server-routes'
import { components, internal } from '../../_generated/api'
import { env, internalAction, internalMutation } from '../../_generated/server'
import { authComponent } from '../../auth'
import { ensurePreferences } from '../../lib/notifications'

/**
 * Instant server alert emails (roadmap Phase 5), sent when an incident on a
 * server someone manages opens or closes (lib/serverEvents.ts). Owners can
 * switch them off in notification settings or from the email itself.
 */

const resend = new Resend(components.resend, { testMode: false })
const EMAIL_FROM =
	process.env.EMAIL_FROM || 'BedrockNexus <noreply@bedrocknexus.com>'

const kindValidator = v.union(
	v.literal('server_offline'),
	v.literal('server_online'),
)

function siteUrl() {
	return (env.SITE_URL ?? 'https://bedrocknexus.com').replace(/\/$/, '')
}

function formatDuration(ms: number) {
	const minutes = Math.max(1, Math.round(ms / 60_000))
	if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`
	const hours = Math.round(minutes / 60)
	if (hours < 48) return hours === 1 ? '1 hour' : `${hours} hours`
	return `${Math.round(hours / 24)} days`
}

/** Who to email and what about; null when nothing should be sent. */
export const prepareServerAlert = internalMutation({
	args: { userId: v.string(), serverId: v.id('servers') },
	returns: v.union(
		v.null(),
		v.object({
			to: v.string(),
			serverName: v.string(),
			serverPath: v.string(),
			unsubscribeToken: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const server = await ctx.db.get(args.serverId)
		if (!server) return null
		const user = (await authComponent.getAnyUserById(ctx, args.userId)) as {
			email?: string
			emailVerified?: boolean
			banned?: boolean | null
		} | null
		if (!user?.email || !user.emailVerified || user.banned) return null
		const prefs = await ensurePreferences(ctx, args.userId)
		if (!prefs.instantAlertEmails) return null
		return {
			to: user.email,
			serverName: server.name,
			serverPath: serverHref(server),
			unsubscribeToken: prefs.unsubscribeToken,
		}
	},
})

export const sendServerAlert = internalAction({
	args: {
		userId: v.string(),
		serverId: v.id('servers'),
		kind: kindValidator,
		at: v.number(),
		durationMs: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const details = await ctx.runMutation(
			internal.functions.social.alerts.prepareServerAlert,
			{ userId: args.userId, serverId: args.serverId },
		)
		if (!details) return null
		const base = siteUrl()
		const offline = args.kind === 'server_offline'
		const when = new Date(args.at).toUTCString()
		const template = EmailTemplate({
			siteUrl: base,
			url: `${base}${details.serverPath}`,
			preview: offline
				? `${details.serverName} stopped answering status checks.`
				: `${details.serverName} is answering status checks again.`,
			heading: offline
				? `${details.serverName} is offline`
				: `${details.serverName} is back online`,
			intro: offline
				? `Your server has not answered BedrockNexus status checks since ${when}. Players see it as offline until it answers again.`
				: `Your server answered again at ${when}${args.durationMs ? ` after about ${formatDuration(args.durationMs)} offline` : ''}.`,
			ctaLabel: 'Open the server page',
			note: `You get this because you manage this server. Turn off instant alert emails in notification settings (${base}/dashboard/settings/notifications) or stop them here: ${base}/notifications/unsubscribe?token=${details.unsubscribeToken}`,
		})
		const [html, text] = await Promise.all([
			render(template),
			render(template, { plainText: true }),
		])
		await resend.sendEmail(ctx, {
			from: EMAIL_FROM,
			to: details.to,
			subject: offline
				? `${details.serverName} is offline`
				: `${details.serverName} is back online`,
			html,
			text,
			headers: [
				{
					name: 'List-Unsubscribe',
					value: `<${base}/api/notifications/unsubscribe?token=${details.unsubscribeToken}>`,
				},
				{ name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
			],
			idempotencyKey: `${args.kind}:${args.serverId}:${args.userId}:${args.at}`,
		})
		return null
	},
})
