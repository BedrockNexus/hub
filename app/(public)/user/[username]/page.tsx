import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import PublicUserProfileClient from '@/components/user-profile/public-user-profile-client'
import { api } from '@/convex/_generated/api'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { getSiteSeo } from '@/lib/site-settings'

interface PublicUserProfilePageProps {
	params: Promise<{ username: string }>
}

export async function generateMetadata({
	params,
}: PublicUserProfilePageProps): Promise<Metadata> {
	const { username } = await params
	const [profile, seo] = await Promise.all([
		fetchQuery(api.functions.site.users.getPublicProfileByUsername, {
			username,
		}),
		getSiteSeo(),
	])

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
			`${displayName} on Bedrock Nexus: ${profile.servers.length} servers and ${profile.projects.length} projects.`,
	)
	const socialImage = profile.bannerUrl ?? profile.image ?? seo.ogImageUrl
	const socialImages = socialImage ? [socialImage] : undefined

	return {
		title: displayName,
		description,
		alternates: {
			canonical: absoluteUrl(`/user/${username}`),
		},
		openGraph: {
			title: `${displayName} | ${seo.siteName}`,
			description,
			type: 'profile',
			url: absoluteUrl(`/user/${username}`),
			images: socialImages,
		},
		twitter: {
			card: profile.image ? 'summary_large_image' : 'summary',
			title: `${displayName} | ${seo.siteName}`,
			description,
			images: socialImages,
		},
	}
}

export default function PublicUserProfilePage() {
	return <PublicUserProfileClient />
}
