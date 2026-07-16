import { Resend } from '@convex-dev/resend'
import { EmailVerificationEmail } from '@better-auth-ui/react/email'
import { render } from '@react-email/render'
import { v } from 'convex/values'
import { components } from '../_generated/api'
import { internalAction } from '../_generated/server'
import {
	ResetPasswordEmailTemplate,
} from '../../components/email/email-template'

const resend = new Resend(components.resend, { testMode: false })
const EMAIL_FROM =
	process.env.EMAIL_FROM || 'BedrockNexus <noreply@bedrocknexus.com>'

async function sendHtmlEmail(
	ctx: Parameters<typeof resend.sendEmail>[0],
	params: { to: string; subject: string; html: string },
): Promise<void> {
	await resend.sendEmail(ctx, {
		from: EMAIL_FROM,
		to: params.to,
		subject: params.subject,
		html: params.html,
	})
}

export const sendVerificationEmail = internalAction({
	args: {
		to: v.string(),
		siteUrl: v.string(),
		url: v.string(),
	},
	handler: async (ctx, args) => {
		const html = await render(
			EmailVerificationEmail({
				url: args.url,
				appName: 'BedrockNexus',
				email: args.to,
				expirationMinutes: 60,
				logoURL: {
					light: `${args.siteUrl}/icon.svg`,
					dark: `${args.siteUrl}/icon.svg`,
				},
				poweredBy: true,
			}),
		)

		await sendHtmlEmail(ctx, {
			to: args.to,
			subject: 'Verify your BedrockNexus email',
			html,
		})
	},
})

export const sendResetPasswordEmail = internalAction({
	args: {
		to: v.string(),
		siteUrl: v.string(),
		url: v.string(),
	},
	handler: async (ctx, args) => {
		const html = await render(
			ResetPasswordEmailTemplate({
				siteUrl: args.siteUrl,
				url: args.url,
			}),
		)

		await sendHtmlEmail(ctx, {
			to: args.to,
			subject: 'Reset your BedrockNexus password',
			html,
		})
	},
})
