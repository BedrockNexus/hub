'use client'

import {
	Copy01Icon,
	MoreHorizontalIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ProjectVersionDownloadButton } from '@/components/projects/detail/project-version-download-button'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ProjectVersionActionsProps {
	fileName: string
	projectSlug: string
	version: string
	versionId: string
}

export function ProjectVersionActions({
	fileName,
	projectSlug,
	version,
	versionId,
}: ProjectVersionActionsProps) {
	const copyText = async (value: string, label: string) => {
		try {
			await navigator.clipboard.writeText(value)
			toast.success(`${label} copied`)
		} catch {
			toast.error(`Failed to copy ${label.toLowerCase()}`)
		}
	}

	return (
		<div className="flex items-center justify-end gap-1">
			<ProjectVersionDownloadButton
				ariaLabel={`Download version ${version}`}
				buttonClassName="text-muted-foreground hover:bg-primary! hover:text-primary-foreground!"
				iconOnly
				showErrorMessage={false}
				size="icon-sm"
				variant="ghost"
				versionId={versionId}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={(props) => (
						<Button
							{...props}
							aria-label={`More options for version ${version}`}
							className="text-muted-foreground hover:bg-primary! hover:text-primary-foreground!"
							size="icon-sm"
							variant="ghost"
						>
							<HugeiconsIcon
								className="size-4"
								icon={MoreHorizontalIcon}
							/>
						</Button>
					)}
				/>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem
						render={
							<Link
								href={`/projects/${projectSlug}/releases/${encodeURIComponent(version)}`}
							/>
						}
					>
						<HugeiconsIcon className="size-4" icon={ViewIcon} />
						View release
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => copyText(version, 'Version')}
					>
						<HugeiconsIcon className="size-4" icon={Copy01Icon} />
						Copy version
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => copyText(fileName, 'File name')}
					>
						<HugeiconsIcon className="size-4" icon={Copy01Icon} />
						Copy file name
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
