import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'

export function EmptyState({
	icon,
	title,
	description,
	action,
}: {
	icon: IconSvgElement
	title: string
	description: string
	action?: ReactNode
}) {
	return (
		<Card className="border-dashed bg-card shadow-none">
			<CardContent className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
				<span className="mb-5 grid size-12 place-items-center rounded-md bg-primary text-primary-foreground">
					<HugeiconsIcon
						aria-hidden="true"
						className="size-5"
						icon={icon}
					/>
				</span>
				<h2 className="font-semibold text-lg">{title}</h2>
				<p className="mt-2 max-w-md text-muted-foreground text-sm leading-6">
					{description}
				</p>
				{action && <div className="mt-6">{action}</div>}
			</CardContent>
		</Card>
	)
}
