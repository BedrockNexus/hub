import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = {
	title: 'Privacy Policy',
	description:
		'Learn how Bedrock Nexus collects, uses, stores, and protects account, content, and usage information.',
	alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
	return (
		<LegalPage
			description="This policy explains what information Bedrock Nexus handles when you browse the site, create an account, or publish community content."
			lastUpdated="July 16, 2026"
			title="Privacy Policy"
		>
			<h2>Information we collect</h2>
			<p>
				We may collect the following information when you use Bedrock
				Nexus:
			</p>
			<ul>
				<li>
					Account information such as your name, username, email
					address, profile image, and authentication-provider
					identifiers.
				</li>
				<li>
					Optional profile information, including your bio, Minecraft
					username, social links, website, location, and profile
					media.
				</li>
				<li>
					Content you submit, including servers, projects,
					organizations, reviews, descriptions, galleries, and
					downloadable files.
				</li>
				<li>
					Server connection and ownership-verification information,
					including hostnames, ports, verification methods, and
					temporary verification proofs.
				</li>
				<li>
					Usage information such as page views, copied server
					addresses, downloads, outbound link clicks, shares, and
					referring pages.
				</li>
				<li>
					Technical information needed to operate and secure the
					service, such as session data, request timestamps, and
					diagnostic logs.
				</li>
			</ul>

			<h2>How we use information</h2>
			<p>We use information to:</p>
			<ul>
				<li>
					Provide accounts, organizations, publishing, and downloads.
				</li>
				<li>
					Verify server ownership and maintain live server status.
				</li>
				<li>Moderate content and communicate review decisions.</li>
				<li>Show creators useful, aggregated content analytics.</li>
				<li>Prevent abuse, enforce limits, and protect the service.</li>
				<li>Send account verification and password-reset messages.</li>
				<li>
					Improve reliability, accessibility, and user experience.
				</li>
			</ul>

			<h2>Public information</h2>
			<p>
				Published profiles, organizations, servers, projects, reviews,
				and associated media are public. Public information may be
				indexed by search engines and shared by other users. Draft and
				review-stage content is limited to authorized owners,
				organization members, and moderators.
			</p>

			<h2>Service providers</h2>
			<p>
				We use infrastructure providers for application hosting,
				database services, object storage, authentication, and
				transactional email. These providers process information only as
				needed to deliver their services to Bedrock Nexus. We do not
				sell personal information or use it for third-party behavioral
				advertising.
			</p>

			<h2>Retention and deletion</h2>
			<p>
				We retain account and published content while it is needed to
				provide the service. Temporary verification proofs and
				unattached uploads are removed on shorter operational schedules.
				Security, moderation, and diagnostic records may be retained
				where reasonably necessary to prevent abuse or meet legal
				obligations.
			</p>
			<p>
				You can update profile information and request account deletion
				from your account settings. Public copies cached by search
				engines or third parties may remain outside our control after
				deletion.
			</p>

			<h2>Your choices</h2>
			<p>
				You may choose which optional profile fields to publish,
				disconnect supported authentication providers, manage active
				sessions, and delete your account. Browser controls can be used
				to manage cookies, although disabling essential cookies may
				prevent sign-in.
			</p>

			<h2>Cookies and local storage</h2>
			<p>
				Bedrock Nexus uses essential cookies and similar browser storage
				to keep accounts secure, maintain sign-in sessions, support
				organization access, and remember interface preferences such as
				theme and dashboard state. These technologies are necessary for
				requested account and creator features to work correctly.
			</p>
			<p>
				Our lightweight first-party analytics record events such as page
				views, copied server addresses, downloads, shares, and outbound
				link clicks. Bedrock Nexus does not use third-party advertising
				cookies or sell browsing data. If non-essential tracking
				technologies are added in the future, this policy and any
				required consent controls will be updated before they are
				enabled.
			</p>
			<p>
				Most browsers let you inspect, block, or delete cookies and
				local storage. Blocking essential storage may prevent
				registration, sign-in, account settings, organizations, and
				creator dashboards from working.
			</p>

			<h2>Children</h2>
			<p>
				Bedrock Nexus is not directed to children under 13. Users must
				meet the minimum age required in their country and obtain
				parental or guardian consent where required.
			</p>

			<h2>Changes and contact</h2>
			<p>
				We may update this policy as the service changes. The updated
				date at the top of this page will identify the latest version.
				Privacy questions or requests can be sent through the official
				Bedrock Nexus support and community links shown in the site
				footer.
			</p>
		</LegalPage>
	)
}
