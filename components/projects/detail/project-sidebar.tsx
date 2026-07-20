'use client'

import { GithubIcon, LinkSquare01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import { format } from 'date-fns'
import Link from 'next/link'
import { ProjectOrganizationOwnerCard } from '@/components/projects/detail/project-organization-owner-card'
import { ProjectTypeDetailsCard } from '@/components/projects/detail/project-type-details-card'
import { ProjectUserOwnerCard } from '@/components/projects/detail/project-user-owner-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import type { ProjectMetadata } from '@/lib/project-metadata'

type Owner =
	| {
			type: 'user'
			username?: string
			displayUsername?: string
			image?: string
	  }
	| {
			type: 'organization'
			name: string
			slug: string
			logo?: string | null
	  }
	| null

type LatestVersion = {
	version: string
	createdAt: number
	gameVersions?: string[] | null
	fileSize?: number
	skinModel?: 'classic' | 'slim'
	validationReport?: { totalUncompressedSize?: number }
} | null

export function ProjectSidebar(props: {
	projectId: string
	categories: Doc<'projectCategories'>[]
	discordUrl?: string | null
	donationUrl?: string | null
	issueTrackerUrl?: string | null
	license?: string | null
	sourceUrl?: string | null
	websiteUrl?: string | null
	wikiUrl?: string | null
	latestVersion: LatestVersion
	metadata?: ProjectMetadata
	owner?: Owner
	publishedAt?: number | null
	updatedAt: number
}) {
	const record = useMutation(api.functions.site.analytics.recordPublicEvent)
	const links = [
		{ label: 'Source Code', href: props.sourceUrl, icon: GithubIcon },
		{
			label: 'Issue Tracker',
			href: props.issueTrackerUrl,
			icon: LinkSquare01Icon,
		},
		{ label: 'Website', href: props.websiteUrl, icon: LinkSquare01Icon },
		{ label: 'Wiki', href: props.wikiUrl, icon: LinkSquare01Icon },
		{ label: 'Discord', href: props.discordUrl, icon: LinkSquare01Icon },
		{ label: 'Donation', href: props.donationUrl, icon: LinkSquare01Icon },
	].flatMap((link) => (link.href ? [{ ...link, href: link.href }] : []))
	const gameVersions = props.latestVersion?.gameVersions ?? []

	return (
		<div className="space-y-4">
			<ProjectTypeDetailsCard
				latestRelease={props.latestVersion}
				metadata={props.metadata}
			/>
			<Card>
				<CardHeader>
					<CardTitle>Project Info</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="space-y-2">
						<h3 className="font-medium text-sm">Game Versions</h3>
						{gameVersions.length > 0 ? (
							<div className="flex flex-wrap gap-1.5">
								{gameVersions.map((version) => (
									<Badge key={version} variant="secondary">
										{version}
									</Badge>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">
								No compatibility info yet
							</p>
						)}
					</div>

					<Separator />

					<div className="space-y-2">
						<h3 className="font-medium text-sm">Categories</h3>
						{props.categories.length > 0 ? (
							<div className="flex flex-wrap gap-1.5">
								{props.categories.map((category) => (
									<Badge key={category._id} variant="outline">
										{category.name}
									</Badge>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">
								No categories yet
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Links</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{links.length > 0 ? (
						links.map((link) => (
							<Button
								className="w-full justify-start"
								key={link.label}
								nativeButton={false}
								onClick={() =>
									record({
										targetType: 'project',
										targetId: props.projectId,
										eventType: 'outbound_click',
									})
								}
								render={
									<Link
										href={link.href}
										rel="noopener noreferrer"
										target="_blank"
									/>
								}
								variant="outline"
							>
								<HugeiconsIcon
									className="size-4"
									icon={link.icon}
								/>
								{link.label}
							</Button>
						))
					) : (
						<p className="text-muted-foreground text-sm">
							No links added
						</p>
					)}
				</CardContent>
			</Card>

			{props.owner && props.owner.type === 'user' && (
				<ProjectUserOwnerCard owner={props.owner} />
			)}

			{props.owner && props.owner.type === 'organization' && (
				<ProjectOrganizationOwnerCard owner={props.owner} />
			)}

			<Card>
				<CardHeader>
					<CardTitle>Details</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground">License</span>
						<span className="text-right font-medium">
							{props.license || 'Not specified'}
						</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground">Published</span>
						<span className="text-right">
							{props.publishedAt
								? format(
										new Date(props.publishedAt),
										'MMM d, yyyy',
									)
								: 'Not published'}
						</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground">
							Last Updated
						</span>
						<span className="text-right">
							{format(new Date(props.updatedAt), 'MMM d, yyyy')}
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
