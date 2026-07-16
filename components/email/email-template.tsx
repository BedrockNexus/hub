interface EmailTemplateProps {
	siteUrl: string
	url: string
	heading: string
	intro: string
	ctaLabel: string
	outro?: string
}

export function EmailTemplate({
	siteUrl,
	url,
	heading,
	intro,
	ctaLabel,
	outro,
}: EmailTemplateProps) {
	return (
		<div style={{ backgroundColor: '#0b0b0f', padding: '32px 20px' }}>
			<div
				style={{
					maxWidth: 600,
					margin: '0 auto',
					backgroundColor: '#111827',
					borderRadius: 16,
					padding: 28,
					border: '1px solid #1f2937',
					color: '#e5e7eb',
					fontFamily:
						'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
				}}
			>
				<div
					style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}
				>
					Bedrock<span style={{ color: '#f43f5e' }}>Nexus</span>
				</div>
				<h1 style={{ fontSize: 22, margin: '0 0 12px' }}>{heading}</h1>
				<p
					style={{
						lineHeight: 1.6,
						color: '#cbd5f5',
						margin: '0 0 16px',
					}}
				>
					{intro}
				</p>
				<p style={{ margin: '0 0 16px' }}>
					<a
						href={url}
						style={{
							display: 'inline-block',
							background:
								'linear-gradient(90deg,#f43f5e,#a21caf)',
							color: '#fff',
							textDecoration: 'none',
							padding: '12px 20px',
							borderRadius: 10,
							fontWeight: 600,
						}}
					>
						{ctaLabel}
					</a>
				</p>
				{outro ? (
					<p
						style={{
							lineHeight: 1.6,
							color: '#cbd5f5',
							margin: '0 0 16px',
						}}
					>
						{outro}
					</p>
				) : null}
				<p style={{ color: '#9ca3af', fontSize: 13, marginTop: 20 }}>
					If the button doesn&apos;t work, copy and paste this link
					into your browser:
				</p>
				<p style={{ color: '#c7d2fe', wordBreak: 'break-all' }}>
					{url}
				</p>
			</div>
			<div
				style={{
					marginTop: 24,
					fontSize: 12,
					color: '#6b7280',
					textAlign: 'center',
				}}
			>
				© {new Date().getFullYear()} BedrockNexus • {siteUrl}
			</div>
		</div>
	)
}

interface VerificationEmailProps {
	siteUrl: string
	url: string
}

export function VerificationEmailTemplate({
	siteUrl,
	url,
}: VerificationEmailProps) {
	return (
		<EmailTemplate
			ctaLabel="Verify email"
			heading="Verify your email address"
			intro="Thanks for joining BedrockNexus. Please verify your email address to activate your account."
			outro={
				"If you didn't create this account, you can safely ignore this email."
			}
			siteUrl={siteUrl}
			url={url}
		/>
	)
}

interface ResetPasswordEmailProps {
	siteUrl: string
	url: string
}

export function ResetPasswordEmailTemplate({
	siteUrl,
	url,
}: ResetPasswordEmailProps) {
	return (
		<EmailTemplate
			ctaLabel="Reset password"
			heading="Reset your password"
			intro="We received a request to reset your password. Use the button below to choose a new one."
			outro={"If you didn't request this, you can ignore this email."}
			siteUrl={siteUrl}
			url={url}
		/>
	)
}
