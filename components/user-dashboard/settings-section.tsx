import type { FormEventHandler, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

/**
 * One settings page of a server, project or plugin: a heading, then the
 * fields, then the save button. With `onSubmit` it is the form itself.
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
			<div>
				<h2 className="font-semibold text-lg tracking-tight">
					{title}
				</h2>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			<Separator />
			{children}
			{footer ? (
				<div className="flex justify-end border-t pt-6">{footer}</div>
			) : null}
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

export function SaveChangesButton({
	isSubmitting,
	disabled,
}: {
	isSubmitting: boolean
	disabled?: boolean
}) {
	return (
		<Button
			className="w-full sm:w-auto"
			disabled={isSubmitting || disabled}
			type="submit"
		>
			{isSubmitting ? (
				<>
					<Spinner className="size-4" />
					Saving...
				</>
			) : (
				'Save Changes'
			)}
		</Button>
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
