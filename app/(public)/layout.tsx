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
			<Navbar pluginsEnabled={features.pluginsEnabled} />
			{/* The footer's ragged top row overlaps the last 32px (footer.tsx),
			    so content stops above it. A page whose background should run
			    under the edge pulls it down with -mb-8 (the home page). */}
			<div className="flex flex-1 flex-col pb-8">{children}</div>
			<Footer
				pluginsEnabled={features.pluginsEnabled}
				socials={socials}
			/>
		</div>
	)
}
