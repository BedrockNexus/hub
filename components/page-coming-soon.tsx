'use client'

import {
	ArrowLeft02Icon,
	ComingSoon01Icon,
	Home07Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PageComingSoonProps {
	title?: string
	description?: string
	showHomeButton?: boolean
	showBackButton?: boolean
}

export function PageComingSoon({
	title = 'Coming Soon',
	description = "We're working hard to bring you this feature. Check back soon!",
	showHomeButton = true,
	showBackButton = true,
}: PageComingSoonProps) {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
			<div className="relative mb-8">
				<div className="absolute inset-0 rounded-full bg-linear-to-r from-rose-500/20 to-fuchsia-900/20 blur-3xl" />
				<div className="relative rounded-full border bg-muted/50 p-6">
					<HugeiconsIcon icon={ComingSoon01Icon} />
				</div>
			</div>

			<h1 className="mb-4 font-bold text-3xl text-foreground tracking-tight md:text-4xl">
				{title}
			</h1>

			<p className="mb-8 max-w-md text-muted-foreground leading-relaxed">
				{description}
			</p>

			<div className="flex flex-wrap items-center justify-center gap-4">
				{showBackButton && (
					<Button
						onClick={() => window.history.back()}
						variant="outline"
					>
						<HugeiconsIcon icon={ArrowLeft02Icon} />
						Go Back
					</Button>
				)}
				{showHomeButton && (
					<Link href="/">
						<Button>
							<HugeiconsIcon icon={Home07Icon} />
							Go Home
						</Button>
					</Link>
				)}
			</div>
		</div>
	)
}
