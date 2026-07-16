'use client'

import { Download04Icon, Refresh01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { type ComponentProps, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface DownloadSuccess {
	ok: true
	url: string
}

interface DownloadFailure {
	ok: false
	code: string
	message: string
}

type DownloadResponse = DownloadSuccess | DownloadFailure

interface ProjectVersionDownloadButtonProps {
	ariaLabel?: string
	buttonClassName?: string
	className?: string
	iconOnly?: boolean
	label?: string
	showErrorMessage?: boolean
	size?: ComponentProps<typeof Button>['size']
	versionId: string
	variant?: ComponentProps<typeof Button>['variant']
}

export function ProjectVersionDownloadButton({
	ariaLabel,
	buttonClassName,
	className,
	iconOnly = false,
	label = 'Download',
	showErrorMessage = true,
	size = 'default',
	versionId,
	variant = 'default',
}: ProjectVersionDownloadButtonProps) {
	const [isDownloading, setIsDownloading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleDownload = async () => {
		setIsDownloading(true)
		setError(null)

		try {
			const response = await fetch(
				`/api/projects/versions/${encodeURIComponent(versionId)}/download?format=json`,
				{
					cache: 'no-store',
					headers: { Accept: 'application/json' },
				},
			)
			const result = (await response.json()) as DownloadResponse

			if (!result.ok) {
				throw new Error(result.message)
			}
			if (!response.ok) {
				throw new Error(
					'We could not prepare the download. Please try again.',
				)
			}

			window.location.assign(result.url)
		} catch (downloadError) {
			setError(
				downloadError instanceof Error
					? downloadError.message
					: 'We could not prepare a fresh download link. Please try again.',
			)
		} finally {
			setIsDownloading(false)
		}
	}

	let buttonLabel = label
	if (isDownloading) {
		buttonLabel = 'Preparing...'
	} else if (error) {
		buttonLabel = 'Try Again'
	}

	let accessibleLabel = ariaLabel ?? label
	if (isDownloading) {
		accessibleLabel = `Preparing ${accessibleLabel.toLowerCase()}`
	} else if (error) {
		accessibleLabel = `${error} Try ${accessibleLabel.toLowerCase()} again.`
	}

	return (
		<div className={cn('flex flex-col gap-2', className)}>
			<Button
				aria-label={iconOnly ? accessibleLabel : undefined}
				className={buttonClassName}
				disabled={isDownloading}
				onClick={handleDownload}
				size={size}
				title={iconOnly ? accessibleLabel : undefined}
				type="button"
				variant={variant}
			>
				{isDownloading ? (
					<Spinner className="size-4" />
				) : (
					<HugeiconsIcon
						className="size-4"
						icon={error ? Refresh01Icon : Download04Icon}
					/>
				)}
				{iconOnly ? null : buttonLabel}
			</Button>
			{error && showErrorMessage && (
				<p
					aria-live="polite"
					className="max-w-72 text-destructive text-xs leading-relaxed"
					role="alert"
				>
					{error}
				</p>
			)}
		</div>
	)
}
