import {
	Body,
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
import { colors, fontFamily, LOGO_HEIGHT, LOGO_WIDTH } from './email-template'

/**
 * The daily or weekly notification digest (convex/functions/social/digest.ts).
 * Same look as the account emails; every colour inline for mail clients.
 */

export interface DigestItem {
	/** e.g. "Sky Islands 2.1.0" */
	title: string
	/** e.g. "New release · Add-on by Nexus Studio" */
	detail: string
	url: string
}

interface DigestEmailProps {
	siteUrl: string
	frequency: 'daily' | 'weekly'
	items: DigestItem[]
	/** Notifications beyond the ones listed. */
	moreCount: number
	notificationsUrl: string
	settingsUrl: string
	unsubscribeUrl: string
}

export function DigestEmailTemplate({
	siteUrl,
	frequency,
	items,
	moreCount,
	notificationsUrl,
	settingsUrl,
	unsubscribeUrl,
}: DigestEmailProps) {
	const total = items.length + moreCount
	const heading =
		total === 1 ? '1 new update' : `${total.toLocaleString()} new updates`
	const period = frequency === 'daily' ? 'today' : 'this week'

	return (
		<Html lang="en">
			<Head>
				<meta content="dark" name="color-scheme" />
				<meta content="dark" name="supported-color-schemes" />
			</Head>
			<Preview>{`${heading} from what you follow on BedrockNexus`}</Preview>
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
								margin: '0 0 8px',
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
								margin: '0 0 20px',
								color: colors.text,
								fontSize: 16,
								lineHeight: '26px',
							}}
						>
							From the creators, organizations and listings you
							follow {period}.
						</Text>

						{items.map((item) => (
							<Section
								key={item.url}
								style={{
									borderTop: `1px solid ${colors.border}`,
									padding: '14px 0',
								}}
							>
								<Link
									href={item.url}
									style={{
										color: colors.heading,
										fontSize: 16,
										fontWeight: 700,
										lineHeight: '22px',
										textDecoration: 'none',
									}}
								>
									{item.title}
								</Link>
								<Text
									style={{
										margin: '2px 0 0',
										color: colors.muted,
										fontSize: 14,
										lineHeight: '20px',
									}}
								>
									{item.detail}
								</Text>
							</Section>
						))}

						<Hr
							style={{
								margin: '8px 0 20px',
								border: 'none',
								borderTop: `1px solid ${colors.border}`,
							}}
						/>
						<Link
							href={notificationsUrl}
							style={{
								color: colors.gold,
								fontSize: 15,
								fontWeight: 700,
							}}
						>
							{moreCount > 0
								? `See ${moreCount.toLocaleString()} more on BedrockNexus`
								: 'Open your notifications'}
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
							You get this {frequency} digest because you turned
							it on.{' '}
							<Link
								href={settingsUrl}
								style={{
									color: colors.muted,
									textDecoration: 'underline',
								}}
							>
								Change notification settings
							</Link>{' '}
							or{' '}
							<Link
								href={unsubscribeUrl}
								style={{
									color: colors.muted,
									textDecoration: 'underline',
								}}
							>
								stop these emails
							</Link>
							.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}
