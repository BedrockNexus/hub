import { absoluteUrl } from './seo'
import { siteBrand } from './site-brand'
import { getSiteSeo } from './site-settings'

interface SocialOptions {
	/** A wide image made for this page, shown as a large card. */
	bannerUrl?: string | null
	/** A square icon or logo, shown as a small card so it is not cropped. */
	iconUrl?: string | null
	type?: 'profile' | 'website'
}

/**
 * The Open Graph and Twitter fields for one page. A page's `openGraph` replaces
 * the root layout's whole object rather than merging with it, so every page that
 * sets one must include all of these.
 */
export function buildSocialMetadata(
	title: string,
	description: string,
	path: string,
	options: SocialOptions & { siteImageUrl?: string | null } = {},
) {
	const { bannerUrl, iconUrl, siteImageUrl, type = 'website' } = options
	const siteImage = siteImageUrl
		? { url: siteImageUrl, alt: siteBrand.socialImageAlt }
		: {
				url: absoluteUrl(siteBrand.socialImage),
				width: 1200,
				height: 630,
				alt: siteBrand.socialImageAlt,
			}
	const pageImage = bannerUrl || iconUrl
	const image = pageImage ? { url: pageImage, alt: title } : siteImage
	const fullTitle = `${title} | ${siteBrand.name}`

	return {
		openGraph: {
			type,
			locale: 'en_US',
			siteName: siteBrand.name,
			title: fullTitle,
			description,
			url: absoluteUrl(path),
			images: [image],
		},
		twitter: {
			card:
				!bannerUrl && iconUrl
					? ('summary' as const)
					: ('summary_large_image' as const),
			title: fullTitle,
			description,
			images: [image],
		},
	}
}

export async function socialMetadata(
	title: string,
	description: string,
	path: string,
	options: SocialOptions = {},
) {
	const seo = await getSiteSeo()
	return buildSocialMetadata(title, description, path, {
		...options,
		siteImageUrl: seo.ogImageUrl,
	})
}
