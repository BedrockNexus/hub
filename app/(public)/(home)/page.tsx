import type { Metadata } from 'next'
import { Hero } from '@/components/home/hero'
import { LatestProjectsSection } from '@/components/home/latest-projects-section'
import { LatestServersSection } from '@/components/home/latest-servers-section'
import { absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
	alternates: {
		canonical: absoluteUrl('/'),
	},
}

export default function Home() {
	return (
		<>
			<Hero />
			<LatestServersSection />
			<LatestProjectsSection />
		</>
	)
}
