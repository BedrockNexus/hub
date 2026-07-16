import type { Metadata } from 'next'
import { PageComingSoon } from '@/components/page-coming-soon'

export const metadata: Metadata = {
	title: 'Blog',
	robots: {
		index: false,
		follow: false,
	},
}

export default function BlogPage() {
	return (
		<PageComingSoon
			description="News, updates, and guides are on the way. Check back soon."
			title="Blog"
		/>
	)
}
