'use client'

import {
	BookOpen01Icon,
	Bug01Icon,
	DiscordIcon,
	FavouriteIcon,
	GlobeIcon,
	SourceCodeIcon,
} from '@hugeicons/core-free-icons'
import { format } from 'date-fns'
import {
	ExternalLinkRow,
	ensureHttpUrl,
	KeyValue,
	SideCard,
} from '@/components/detail/detail-parts'
import { ProjectOrganizationOwnerCard } from '@/components/projects/detail/project-organization-owner-card'
import { ProjectTypeDetailsCard } from '@/components/projects/detail/project-type-details-card'
import { ProjectUserOwnerCard } from '@/components/projects/detail/project-user-owner-card'
import { TagChip } from '@/components/servers/server-bits'
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
} | null

export function ProjectSidebar(props: {
	categories: Doc<'projectCategories'>[]
	discordUrl?: string | null
	donationUrl?: string | null
	issueTrackerUrl?: string | null
	license?: string | null
	licenseCustom?: string | null
	sourceUrl?: string | null
	websiteUrl?: string | null
	wikiUrl?: string | null
	latestVersion: LatestVersion
	metadata?: ProjectMetadata
	owner?: Owner
	publishedAt?: number | null
	tags?: string[]
	updatedAt: number
}) {
	const links = [
		{ label: 'Source code', href: props.sourceUrl, icon: SourceCodeIcon },
		{
			label: 'Issue tracker',
			href: props.issueTrackerUrl,
			icon: Bug01Icon,
		},
		{ label: 'Website', href: props.websiteUrl, icon: GlobeIcon },
		{ label: 'Wiki', href: props.wikiUrl, icon: BookOpen01Icon },
		{ label: 'Discord', href: props.discordUrl, icon: DiscordIcon },
		{
			label: 'Support the creator',
			href: props.donationUrl,
			icon: FavouriteIcon,
		},
	].flatMap((link) =>
		link.href ? [{ ...link, href: ensureHttpUrl(link.href) }] : [],
	)
	const gameVersions = props.latestVersion?.gameVersions ?? []
	const license = props.licenseCustom || props.license

	return (
		<aside className="flex min-w-0 flex-col gap-4">
			<SideCard title="Compatibility">
				{gameVersions.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{gameVersions.map((version) => (
							<TagChip key={version}>Bedrock {version}</TagChip>
						))}
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						No compatibility info yet
					</p>
				)}
			</SideCard>

			<ProjectTypeDetailsCard metadata={props.metadata} />

			{props.categories.length > 0 ? (
				<SideCard title="Categories">
					<div className="flex flex-wrap gap-1.5">
						{props.categories.map((category) => (
							<TagChip key={category._id}>
								{category.name}
							</TagChip>
						))}
					</div>
				</SideCard>
			) : null}

			{props.tags && props.tags.length > 0 ? (
				<SideCard title="Tags">
					<div className="flex flex-wrap gap-1.5">
						{props.tags.map((tag) => (
							<TagChip key={tag}>{tag}</TagChip>
						))}
					</div>
				</SideCard>
			) : null}

			{links.length > 0 ? (
				<SideCard title="Links">
					<div className="flex flex-col gap-2">
						{links.map((link) => (
							<ExternalLinkRow
								href={link.href}
								icon={link.icon}
								key={link.label}
								label={link.label}
							/>
						))}
					</div>
				</SideCard>
			) : null}

			<SideCard title="Details">
				<dl>
					<KeyValue label="License">
						{license || 'Not specified'}
					</KeyValue>
					{props.publishedAt ? (
						<KeyValue label="Published">
							{format(new Date(props.publishedAt), 'MMM d, yyyy')}
						</KeyValue>
					) : null}
					<KeyValue label="Updated">
						{format(new Date(props.updatedAt), 'MMM d, yyyy')}
					</KeyValue>
				</dl>
			</SideCard>

			{props.owner?.type === 'user' ? (
				<ProjectUserOwnerCard owner={props.owner} />
			) : null}
			{props.owner?.type === 'organization' ? (
				<ProjectOrganizationOwnerCard owner={props.owner} />
			) : null}
		</aside>
	)
}
