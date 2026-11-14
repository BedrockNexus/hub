import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from 'react-email'

/**
 * Account emails (verify email, reset password), rendered in a Convex action
 * (convex/functions/email.ts). They follow the site's dark and gold look.
 *
 * Mail clients ignore stylesheets and CSS variables, so every colour is
 * written out inline. Keep them in step with the dark palette in
 * app/globals.css.
 */
export const colors = {
	page: '#0d0f13',
	card: '#15181e',
	border: '#252a33',
	heading: '#eceef2',
	text: '#c3c9d4',
	muted: '#9199a7',
	gold: '#f7c548',
	goldEdge: '#936018',
	goldHighlight: '#fbe2a3',
	onGold: '#1d1405',
}

export const fontFamily =
	'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
const monoFamily = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

// The wordmark is 2000 x 802; shown at 176 wide.
export const LOGO_WIDTH = 176
export const LOGO_HEIGHT = 71

interface EmailTemplateProps {
	siteUrl: string
	/** Where the button goes. */
	url: string
	/** The line mail clients show next to the subject. */
	preview: string
	heading: string
	intro: string
	ctaLabel: string
	/** How long the link works and what to do if the email is unexpected. */
	note: string
}

export function EmailTemplate({
	siteUrl,
	url,
	preview,
	heading,
	intro,
	ctaLabel,
	note,
}: EmailTemplateProps) {
	const siteHost = new URL(siteUrl).host

	return (
		<Html lang="en">
			<Head>
				<meta content="dark" name="color-scheme" />
				<meta content="dark" name="supported-color-schemes" />
			</Head>
			<Preview>{preview}</Preview>
			<Body
				style={{
					margin: 0,
					padding: '32px 16px',
					backgroundColor: colors.page,
					fontFamily,
				}}
			>
				<Container style={{ maxWidth: 560, margin: '0 auto' }}>
					<Section style={{ padding: '0 4px 20px' }}>
						<Link href={siteUrl}>
							<Img
								alt="BedrockNexus"
								height={LOGO_HEIGHT}
								src={`${siteUrl}/images/bedrocknexus-logo.png`}
								// Shown when the client blocks images.
								style={{
									color: colors.gold,
									fontFamily,
									fontSize: 22,
									fontWeight: 700,
								}}
								width={LOGO_WIDTH}
							/>
						</Link>
					</Section>

					<Section
						style={{
							backgroundColor: colors.card,
							border: `1px solid ${colors.border}`,
							borderTop: `4px solid ${colors.gold}`,
							borderRadius: 6,
							padding: '32px 32px 28px',
						}}
					>
						<Heading
							as="h1"
							style={{
								margin: '0 0 12px',
								color: colors.heading,
								fontSize: 24,
								fontWeight: 700,
								lineHeight: '32px',
							}}
						>
							{heading}
						</Heading>
						<Text
							style={{
								margin: '0 0 24px',
								color: colors.text,
								fontSize: 16,
								lineHeight: '26px',
							}}
						>
							{intro}
						</Text>

						<Button
							href={url}
							style={{
								backgroundColor: colors.gold,
								borderTop: `1px solid ${colors.goldHighlight}`,
								borderBottom: `4px solid ${colors.goldEdge}`,
								color: colors.onGold,
								fontSize: 16,
								fontWeight: 700,
								lineHeight: '20px',
								padding: '13px 26px',
								textDecoration: 'none',
							}}
						>
							{ctaLabel}
						</Button>

						<Text
							style={{
								margin: '24px 0 0',
								color: colors.muted,
								fontSize: 14,
								lineHeight: '22px',
							}}
						>
							{note}
						</Text>

						<Hr
							style={{
								margin: '24px 0 20px',
								border: 'none',
								borderTop: `1px solid ${colors.border}`,
							}}
						/>

						<Text
							style={{
								margin: '0 0 6px',
								color: colors.muted,
								fontSize: 13,
								lineHeight: '20px',
							}}
						>
							Button not working? Copy this link into your
							browser:
						</Text>
						<Link
							href={url}
							style={{
								color: colors.gold,
								fontFamily: monoFamily,
								fontSize: 12,
								lineHeight: '18px',
								wordBreak: 'break-all',
							}}
						>
							{url}
						</Link>
					</Section>

					<Section style={{ padding: '20px 4px 0' }}>
						<Text
							style={{
								margin: 0,
								color: colors.muted,
								fontSize: 12,
								lineHeight: '18px',
							}}
						>
							BedrockNexus, the home for Minecraft Bedrock
							servers, addons and the people who make them.
							<br />
							<Link
								href={siteUrl}
								style={{
									color: colors.muted,
									textDecoration: 'underline',
								}}
							>
								{siteHost}
							</Link>
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

interface AccountEmailProps {
	siteUrl: string
	url: string
}

export function VerificationEmailTemplate({ siteUrl, url }: AccountEmailProps) {
	return (
		<EmailTemplate
			ctaLabel="Verify email"
			heading="Verify your email"
			intro="Thanks for joining BedrockNexus. Confirm this email address to finish creating your account. The button logs you in straight away."
			note="This link works for 1 hour. If you did not create a BedrockNexus account, you can ignore this email."
			preview="Confirm your email to finish creating your BedrockNexus account."
			siteUrl={siteUrl}
			url={url}
		/>
	)
}

export function ResetPasswordEmailTemplate({
	siteUrl,
	url,
}: AccountEmailProps) {
	return (
		<EmailTemplate
			ctaLabel="Reset password"
			heading="Reset your password"
			intro="We received a request to reset the password for your BedrockNexus account. Use the button below to choose a new one."
			note="This link works for 1 hour. If you did not ask for this, you can ignore this email and your password stays the same."
			preview="Choose a new password for your BedrockNexus account."
			siteUrl={siteUrl}
			url={url}
		/>
	)
}
