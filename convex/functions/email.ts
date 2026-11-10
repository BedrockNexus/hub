import { Resend } from '@convex-dev/resend'
import { render } from '@react-email/render'
import { v } from 'convex/values'
import type { ReactElement } from 'react'
import {
	ResetPasswordEmailTemplate,
	VerificationEmailTemplate,
} from '../../components/email/email-template'
import { components } from '../_generated/api'
import { internalAction } from '../_generated/server'

const resend = new Resend(components.resend, { testMode: false })
const EMAIL_FROM =
	process.env.EMAIL_FROM || 'BedrockNexus <noreply@bedrocknexus.com>'

/** Sends a template as HTML with a plain-text copy for clients that want one. */
async function sendTemplateEmail(
	ctx: Parameters<typeof resend.sendEmail>[0],
	params: { to: string; subject: string; template: ReactElement },
): Promise<void> {
	const [html, text] = await Promise.all([
		render(params.template),
		render(params.template, { plainText: true }),
	])
	await resend.sendEmail(ctx, {
		from: EMAIL_FROM,
		to: params.to,
		subject: params.subject,
		html,
		text,
	})
}

const linkEmailArgs = {
	to: v.string(),
	siteUrl: v.string(),
	url: v.string(),
}

export const sendVerificationEmail = internalAction({
	args: linkEmailArgs,
	handler: async (ctx, args) => {
		await sendTemplateEmail(ctx, {
			to: args.to,
			subject: 'Verify your BedrockNexus email',
			template: VerificationEmailTemplate({
				siteUrl: args.siteUrl,
				url: args.url,
			}),
		})
	},
})

export const sendResetPasswordEmail = internalAction({
	args: linkEmailArgs,
	handler: async (ctx, args) => {
		await sendTemplateEmail(ctx, {
			to: args.to,
			subject: 'Reset your BedrockNexus password',
			template: ResetPasswordEmailTemplate({
				siteUrl: args.siteUrl,
				url: args.url,
			}),
		})
	},
})
