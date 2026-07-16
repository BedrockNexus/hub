'use client'

import { Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface DashboardPageHeaderProps {
	title: string
	description: string
	createHref?: string
	createLabel?: string
}

export function DashboardPageHeader({
	title,
	description,
	createHref,
	createLabel,
}: DashboardPageHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex flex-col gap-1">
				<h2 className="font-bold text-2xl tracking-tight">{title}</h2>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			{createHref && createLabel ? (
				<Button
					nativeButton={false}
					render={(props) => <Link {...props} href={createHref} />}
				>
					<HugeiconsIcon className="size-4" icon={Add01Icon} />
					{createLabel}
				</Button>
			) : null}
		</div>
	)
}
