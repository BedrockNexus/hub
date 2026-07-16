'use client'

import { Add01Icon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface DashboardEmptyStateProps {
	icon: IconSvgElement
	title: string
	description: string
	createHref: string
	createLabel: string
}

export function DashboardEmptyState({
	icon,
	title,
	description,
	createHref,
	createLabel,
}: DashboardEmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
			<div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
				<HugeiconsIcon
					className="size-8 text-muted-foreground"
					icon={icon}
				/>
			</div>
			<h3 className="mb-1 font-semibold text-lg">{title}</h3>
			<p className="mx-auto mb-6 max-w-sm text-muted-foreground text-sm">
				{description}
			</p>
			<Button
				nativeButton={false}
				render={(props) => <Link {...props} href={createHref} />}
			>
				<HugeiconsIcon className="size-4" icon={Add01Icon} />
				{createLabel}
			</Button>
		</div>
	)
}
