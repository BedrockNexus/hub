import type { FormEventHandler, ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { SettingsPageHeader } from '@/components/user-dashboard/settings-card'

/**
 * One settings page of a server, project or plugin: a heading, then the
 * fields, then the footer (a SaveBar). With `onSubmit` it is the form itself.
 */
export function SettingsSection({
	title,
	description,
	children,
	footer,
	onSubmit,
}: {
	title: string
	description: string
	children: ReactNode
	footer?: ReactNode
	onSubmit?: FormEventHandler<HTMLFormElement>
}) {
	const content = (
		<>
			<SettingsPageHeader description={description} title={title} />
			{children}
			{footer}
		</>
	)
	return onSubmit ? (
		<form className="space-y-6" onSubmit={onSubmit}>
			{content}
		</form>
	) : (
		<div className="space-y-6">{content}</div>
	)
}

export function SettingsSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-6 w-48" />
			<Skeleton className="h-4 w-64" />
			<Skeleton className="h-px w-full" />
			<div className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		</div>
	)
}
