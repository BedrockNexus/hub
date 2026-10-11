import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSiteFeatures } from '@/lib/site-settings'

/** The plugin publishing pages exist only while the Plugins feature is switched on in admin settings. */
export default async function DashboardPluginsLayout({
	children,
}: {
	children: ReactNode
}) {
	const features = await getSiteFeatures()
	if (!features.pluginsEnabled) {
		notFound()
	}
	return children
}
