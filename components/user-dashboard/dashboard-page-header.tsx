'use client'

import { Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WorkspacePageHeader } from '@/components/workspace-page-header'

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
		<WorkspacePageHeader
			actions={
				createHref && createLabel ? (
					<Button
						nativeButton={false}
						render={(props) => (
							<Link {...props} href={createHref} />
						)}
					>
						<HugeiconsIcon className="size-4" icon={Add01Icon} />
						{createLabel}
					</Button>
				) : undefined
			}
			description={description}
			title={title}
		/>
	)
}
