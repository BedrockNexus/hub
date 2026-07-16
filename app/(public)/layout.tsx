import type React from 'react'
import { Footer } from '@/components/layout/footer'
import { Navbar } from '@/components/layout/navbar'
import { getSiteSeo, getSiteSocials } from '@/lib/site-settings'

export default async function PublicLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const [seo, socials] = await Promise.all([getSiteSeo(), getSiteSocials()])

	return (
		<div className="flex min-h-screen flex-col pb-20 lg:pb-0">
			<Navbar
				siteLogo={seo.siteLogoUrl ?? '/images/bedrocknexus-logo.png'}
				siteName={seo.siteName}
			/>
			<main className="flex-1">{children}</main>
			<Footer
				siteLogo={seo.siteLogoUrl ?? '/images/bedrocknexus-logo.png'}
				siteName={seo.siteName}
				socials={socials}
			/>
		</div>
	)
}
