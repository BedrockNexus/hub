'use client'

import { useQuery } from 'convex/react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { GalleryManager } from '@/components/user-dashboard/gallery/gallery-manager'
import { api } from '@/convex/_generated/api'

interface GallerySettingsFormProps {
	slug: string
}

export function GallerySettingsForm({ slug }: GallerySettingsFormProps) {
	const server = useQuery(
		api.functions.servers.servers.getBySlug,
		slug ? { slug } : 'skip',
	)

	if (server === undefined) {
		return (
			<div className="space-y-6">
				<div>
					<Skeleton className="h-6 w-28" />
					<Skeleton className="mt-2 h-4 w-72" />
				</div>
				<Separator />
				<Skeleton className="h-32 w-full rounded-lg" />
				<div className="grid gap-4 sm:grid-cols-2">
					<Skeleton className="h-64 rounded-lg" />
					<Skeleton className="h-64 rounded-lg" />
				</div>
			</div>
		)
	}

	if (server === null) {
		return (
			<div className="py-12 text-center">
				<h2 className="font-semibold text-xl">Server not found</h2>
				<p className="mt-2 text-muted-foreground">
					The server you&apos;re looking for doesn&apos;t exist or you
					don&apos;t have access to it.
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
					Add screenshots of your server to attract players
				</p>
			</div>
			<Separator />
			<GalleryManager entityId={server._id} kind="server" />
		</div>
	)
}
