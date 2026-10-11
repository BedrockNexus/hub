import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'

export function RegistrySection({
	title,
	description,
	action,
	children,
}: {
	title: string
	description?: string
	action?: ReactNode
	children: ReactNode
}) {
	return (
		<section>
			<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 className="font-semibold text-xl tracking-tight">
						{title}
					</h2>
					{description && (
						<p className="mt-1 text-muted-foreground text-sm">
							{description}
						</p>
					)}
				</div>
				{action}
			</div>
			{children}
		</section>
	)
}

export function RegistryMetric({
	label,
	value,
	detail,
}: {
	label: string
	value: string
	detail: string
}) {
	return (
		<Card className="shadow-none">
			<CardContent>
				<p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.14em]">
					{label}
				</p>
				<p className="mt-3 font-semibold text-2xl tracking-tight">
					{value}
				</p>
				<p className="mt-1 text-muted-foreground text-xs">{detail}</p>
			</CardContent>
		</Card>
	)
}
