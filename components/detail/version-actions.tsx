'use client'

import {
	Copy01Icon,
	Download04Icon,
	MoreHorizontalIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'
import { toast } from 'sonner'
import { ProjectVersionDownloadButton } from '@/components/projects/detail/project-version-download-button'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface VersionActionsProps {
	version: string
	detailsHref: string
	fileName?: string
	downloadUrl?: string
	downloadMode?: 'redirect' | 'json'
}

const iconClassName =
	'text-muted-foreground hover:bg-primary! hover:text-primary-foreground!'

export function VersionActions({
	version,
	detailsHref,
	fileName,
	downloadUrl,
	downloadMode = 'redirect',
}: VersionActionsProps) {
	async function copyText(value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value)
			toast.success(`${label} copied`)
		} catch {
			toast.error(`Failed to copy ${label.toLowerCase()}`)
		}
	}
	let download = (
		<Button
			aria-label={`Download version ${version} unavailable`}
			className={iconClassName}
			disabled
			size="icon-sm"
			variant="ghost"
		>
			<HugeiconsIcon
				aria-hidden
				className="size-4"
				icon={Download04Icon}
			/>
		</Button>
	)
	if (downloadUrl && downloadMode === 'json') {
		download = (
			<ProjectVersionDownloadButton
				ariaLabel={`Download version ${version}`}
				buttonClassName={iconClassName}
				downloadUrl={downloadUrl}
				iconOnly
				showErrorMessage={false}
				size="icon-sm"
				variant="ghost"
			/>
		)
	} else if (downloadUrl) {
		download = (
			<Link
				aria-label={`Download version ${version}`}
				className={buttonVariants({
					size: 'icon-sm',
					variant: 'ghost',
					className: iconClassName,
				})}
				data-track="download_clicked"
				href={downloadUrl as Route}
				prefetch={false}
				rel="nofollow"
				title={`Download version ${version}`}
			>
				<HugeiconsIcon
					aria-hidden
					className="size-4"
					icon={Download04Icon}
				/>
			</Link>
		)
	}
	return (
		<div className="flex items-center justify-end gap-1">
			{download}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={(props) => (
						<Button
							{...props}
							aria-label={`More options for version ${version}`}
							className={iconClassName}
							size="icon-sm"
							variant="ghost"
						>
							<HugeiconsIcon
								aria-hidden
								className="size-4"
								icon={MoreHorizontalIcon}
							/>
						</Button>
					)}
				/>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem
						nativeButton={false}
						render={(props) => (
							<Link {...props} href={detailsHref as Route} />
						)}
					>
						<HugeiconsIcon
							aria-hidden
							className="size-4"
							icon={ViewIcon}
						/>
						View release
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => copyText(version, 'Version')}
					>
						<HugeiconsIcon
							aria-hidden
							className="size-4"
							icon={Copy01Icon}
						/>
						Copy version
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!fileName}
						onClick={() => {
							if (fileName) {
								return copyText(fileName, 'File name')
							}
						}}
					>
						<HugeiconsIcon
							aria-hidden
							className="size-4"
							icon={Copy01Icon}
						/>
						Copy file name
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
