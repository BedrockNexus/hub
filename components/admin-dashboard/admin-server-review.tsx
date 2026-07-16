'use client'

import {
	ArrowLeft02Icon,
	CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Image from 'next/image'
import Link from 'next/link'
import {
	LifecycleStatusBadge,
	ModerationStatusBadge,
} from '@/components/admin-dashboard/admin-content-status'
import { AdminModerationActions } from '@/components/admin-dashboard/admin-moderation-actions'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export function AdminServerReview({ serverId }: { serverId: string }) {
	const server = useQuery(api.functions.servers.servers.getAdminReview, {
		id: serverId as Id<'servers'>,
	})

	if (server === undefined) {
		return <Skeleton className="h-[70svh] w-full rounded-lg" />
	}

	if (!server) {
		return (
			<Card>
				<CardContent className="py-16 text-center">
					<h1 className="font-semibold text-xl">Server not found</h1>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-3">
					<Button
						nativeButton={false}
						render={<Link href="/admin/servers" />}
						variant="ghost"
					>
						<HugeiconsIcon
							className="size-4"
							icon={ArrowLeft02Icon}
						/>
						Servers
					</Button>
					<div className="flex items-center gap-4">
						{server.logoUrl ? (
							<Image
								alt={`${server.name} logo`}
								className="size-16 rounded-lg border object-cover"
								height={64}
								src={server.logoUrl}
								width={64}
							/>
						) : null}
						<div>
							<h1 className="font-semibold text-2xl">
								{server.name}
							</h1>
							<p className="text-muted-foreground text-sm">
								{server.ipAddress}:{server.port}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<LifecycleStatusBadge status={server.status} />
						<ModerationStatusBadge
							status={server.moderationStatus}
						/>
						{server.verifiedAt ? (
							<Badge variant="secondary">
								<HugeiconsIcon
									className="size-3.5"
									icon={CheckmarkCircle01Icon}
								/>
								Ownership verified
							</Badge>
						) : (
							<Badge variant="destructive">Not verified</Badge>
						)}
					</div>
				</div>
				<AdminModerationActions
					contentId={server._id}
					contentName={server.name}
					contentType="server"
					moderationStatus={server.moderationStatus}
					status={server.status}
				/>
			</div>

			{server.moderationReason ? (
				<Card className="border-destructive/40">
					<CardHeader>
						<CardTitle className="text-base">
							Current moderation note
						</CardTitle>
					</CardHeader>
					<CardContent className="text-sm">
						{server.moderationReason}
					</CardContent>
				</Card>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="space-y-6">
					{server.bannerUrl ? (
						<Image
							alt={`${server.name} banner`}
							className="aspect-[3/1] w-full rounded-lg border object-cover"
							height={400}
							src={server.bannerUrl}
							width={1200}
						/>
					) : null}
					<Card>
						<CardHeader>
							<CardTitle>Description</CardTitle>
						</CardHeader>
						<CardContent>
							<RichTextViewer
								content={
									server.description ||
									server.smallDescription
								}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Gallery</CardTitle>
						</CardHeader>
						<CardContent>
							<GalleryGrid
								emptyDescription="No screenshots were supplied."
								emptyTitle="No gallery images"
								items={server.gallery}
							/>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								Submission details
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<div>
								<p className="text-muted-foreground">Owner</p>
								<p>
									{server.owner?.type === 'organization'
										? server.owner.name
										: server.owner?.displayUsername ||
											server.owner?.username ||
											'Unknown user'}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">
									Verification
								</p>
								<p>
									{server.verificationMethod
										? server.verificationMethod.replace(
												'_',
												' ',
											)
										: 'Not verified'}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Region</p>
								<p>{server.region || 'Not provided'}</p>
							</div>
							<div>
								<p className="text-muted-foreground">
									Game versions
								</p>
								<p>
									{server.gameVersions?.join(', ') ||
										'Not provided'}
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
