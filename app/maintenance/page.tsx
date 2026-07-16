import { ToolsIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getSiteFeatures, getSiteSeo } from '@/lib/site-settings'

export const metadata: Metadata = {
	title: 'Maintenance',
	description: 'BedrockNexus is temporarily unavailable for maintenance.',
	robots: {
		index: false,
		follow: false,
	},
}

export default async function MaintenancePage() {
	const [features, seo] = await Promise.all([getSiteFeatures(), getSiteSeo()])

	if (!features.maintenanceMode) {
		redirect('/')
	}

	return (
		<main className="flex min-h-screen items-center justify-center px-6 py-16">
			<div className="flex w-full max-w-lg flex-col items-center text-center">
				<Image
					alt={seo.siteName}
					className="mb-10 h-auto w-full max-w-sm object-contain"
					height={220}
					priority
					src={seo.siteLogoUrl ?? '/images/bedrocknexus-logo.png'}
					unoptimized
					width={560}
				/>
				<div className="mb-5 flex size-12 items-center justify-center rounded-md border bg-muted">
					<HugeiconsIcon className="size-6" icon={ToolsIcon} />
				</div>
				<h1 className="font-bold text-3xl">We’ll be back shortly</h1>
				<p className="mt-3 max-w-md text-muted-foreground">
					BedrockNexus is undergoing maintenance. Existing data is
					safe and the site will return once the work is complete.
				</p>
				<Button
					className="mt-8"
					render={<Link href="/login" />}
					variant="outline"
				>
					Staff login
				</Button>
			</div>
		</main>
	)
}
