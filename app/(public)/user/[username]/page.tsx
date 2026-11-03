import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import PublicUserProfileClient from '@/components/user-profile/public-user-profile-client'
import { api } from '@/convex/_generated/api'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { socialMetadata } from '@/lib/social-metadata'

interface PublicUserProfilePageProps {
	params: Promise<{ username: string }>
}

export async function generateMetadata({
	params,
}: PublicUserProfilePageProps): Promise<Metadata> {
	const { username } = await params
	const profile = await fetchQuery(
		api.functions.site.users.getPublicProfileByUsername,
		{ username },
	)

	if (!profile) {
		return {
			title: 'User Not Found',
			robots: { index: false, follow: false },
		}
	}

	const displayName =
		profile.displayName ??
		profile.displayUsername ??
		profile.username ??
		username
	const description = truncateDescription(
		profile.bio ||
			`${displayName} on Bedrock Nexus: ${profile.servers.length} servers and ${profile.projects.length} addons and resource packs.`,
	)
	const path = `/user/${username}`

	return {
		title: displayName,
		description,
		alternates: { canonical: absoluteUrl(path) },
		...(await socialMetadata(displayName, description, path, {
			bannerUrl: profile.bannerUrl,
			iconUrl: profile.image,
			type: 'profile',
		})),
	}
}

export default function PublicUserProfilePage() {
	return <PublicUserProfileClient />
}
