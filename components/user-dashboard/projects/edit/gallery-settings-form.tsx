'use client'

import { useQuery } from 'convex/react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { GalleryManager } from '@/components/user-dashboard/gallery/gallery-manager'
import { api } from '@/convex/_generated/api'

interface ProjectGallerySettingsFormProps {
	id: string
}

export function ProjectGallerySettingsForm({
	id,
}: ProjectGallerySettingsFormProps) {
	const project = useQuery(
		api.functions.projects.projects.getForEdit,
		id ? { id } : 'skip',
	)

	if (project === undefined) {
		return (
			<div className="space-y-6">
				<div>
					<Skeleton className="h-6 w-28" />
					<Skeleton className="mt-2 h-4 w-80" />
				</div>
				<Separator />
				<Skeleton className="h-32 w-full rounded-md" />
				<div className="grid gap-4 sm:grid-cols-2">
					<Skeleton className="h-64 rounded-md" />
					<Skeleton className="h-64 rounded-md" />
				</div>
			</div>
		)
	}

	if (project === null) {
		return (
			<div className="py-12 text-center">
				<h2 className="font-semibold text-xl">Listing not found</h2>
				<p className="mt-2 text-muted-foreground">
					The listing you&apos;re looking for doesn&apos;t exist or
					you don&apos;t have access to it.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg tracking-tight">
					Gallery
				</h2>
				<p className="text-muted-foreground text-sm">
					Add screenshots of your listing to showcase it to users
				</p>
			</div>
			<Separator />
			<GalleryManager entityId={project._id} kind="project" />
		</div>
	)
}
