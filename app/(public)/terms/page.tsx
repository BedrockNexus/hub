import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = {
	title: 'Terms of Service',
	description:
		'Review the rules for accounts, publishing, moderation, downloads, and acceptable use of Bedrock Nexus.',
	alternates: { canonical: '/terms' },
}

export default function TermsPage() {
	return (
		<LegalPage
			description="These terms set the rules for using Bedrock Nexus and publishing servers, projects, organizations, reviews, and files."
			lastUpdated="July 16, 2026"
			title="Terms of Service"
		>
			<h2>Acceptance and eligibility</h2>
			<p>
				By accessing or using Bedrock Nexus, you agree to these terms.
				You must be at least 13 years old, meet the minimum
				digital-consent age in your country, and have guardian
				permission where required. If you use the service for a team or
				organization, you confirm that you are authorized to act for it.
			</p>

			<h2>Accounts and security</h2>
			<p>
				Provide accurate account information and keep your credentials
				secure. You are responsible for activity performed through your
				account and organization roles. Notify Bedrock Nexus through its
				official support channels if you believe your account has been
				compromised.
			</p>

			<h2>Publishing and ownership</h2>
			<p>
				You retain ownership of content you submit. You grant Bedrock
				Nexus a non-exclusive, worldwide license to host, store,
				reproduce, resize, display, and distribute that content only as
				needed to operate, promote, and improve the service.
			</p>
			<p>
				You must have permission to publish every description, image,
				logo, project file, trademark, and other asset you submit.
				Server verification confirms control of a server endpoint at a
				point in time; it does not grant rights to third-party content
				or brands.
			</p>

			<h2>Acceptable use</h2>
			<p>You may not use Bedrock Nexus to:</p>
			<ul>
				<li>
					Publish illegal, fraudulent, deceptive, or infringing
					content.
				</li>
				<li>
					Distribute malware, credential theft, or intentionally
					harmful files.
				</li>
				<li>
					Harass others or publish hateful, exploitative, or sexual
					content.
				</li>
				<li>
					Manipulate reviews, downloads, favourites, analytics, or
					rankings.
				</li>
				<li>
					Evade moderation, verification, access controls, or rate
					limits.
				</li>
				<li>
					Scrape, overload, disrupt, probe, or reverse engineer the
					service.
				</li>
				<li>Impersonate another person, team, server, or project.</li>
			</ul>

			<h2>Projects and downloads</h2>
			<p>
				Creators are responsible for their project files, licenses,
				support, and compatibility claims. Users download and run
				community files at their own risk and should review permissions,
				source information, and license terms before installation.
				Bedrock Nexus does not guarantee that community files are
				secure, compatible, or continuously available.
			</p>

			<h2>Moderation</h2>
			<p>
				Bedrock Nexus may review, flag, reject, unpublish, restrict, or
				remove content and accounts to enforce these terms, protect
				users, respond to legal requests, or maintain service quality.
				Servers may become public after ownership verification while
				awaiting post-publication review. Projects require approval
				before publication because they distribute downloadable files.
			</p>

			<h2>Third-party services</h2>
			<p>
				Links, authentication providers, servers, downloads, and
				community websites are operated by third parties under their own
				terms. Bedrock Nexus is not affiliated with Mojang Studios or
				Microsoft, and use of Minecraft names and assets remains subject
				to their applicable rules.
			</p>

			<h2>Availability and liability</h2>
			<p>
				The service is provided on an as-available basis. Features may
				change, be suspended, or be discontinued. To the extent
				permitted by law, Bedrock Nexus is not liable for indirect
				losses, lost data, community server outages, incompatible
				downloads, or actions taken by third parties.
			</p>

			<h2>Termination, changes, and contact</h2>
			<p>
				You may stop using the service or delete your account. We may
				suspend or terminate access for serious or repeated violations.
				We may update these terms as the service changes; continued use
				after an update means you accept the revised terms. Questions
				can be sent through the official Bedrock Nexus support and
				community links in the footer.
			</p>
		</LegalPage>
	)
}
