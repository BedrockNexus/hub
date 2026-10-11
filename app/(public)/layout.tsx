import type React from 'react'
import { Footer } from '@/components/layout/footer'
import { Navbar } from '@/components/layout/navbar'
import { getSiteFeatures, getSiteSocials } from '@/lib/site-settings'

export default async function PublicLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const [socials, features] = await Promise.all([
		getSiteSocials(),
		getSiteFeatures(),
	])

	return (
		<div className="flex min-h-screen flex-col pb-20 lg:pb-0">
			<Navbar />
			<div className="flex flex-1 flex-col">{children}</div>
			<Footer
				pluginsEnabled={features.pluginsEnabled}
				socials={socials}
			/>
		</div>
	)
}
