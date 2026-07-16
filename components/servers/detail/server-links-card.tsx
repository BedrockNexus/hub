'use client'

import { DiscordIcon, LinkSquare01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/convex/_generated/api'

type ServerLinks = Partial<{
	website: string
	discordUrl: string
	storeUrl: string
	wikiUrl: string
}>

function ensureUrl(url: string) {
	if (!url) {
		return url
	}
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url
	}
	return `https://${url}`
}

export function ServerLinksCard(props: {
	links: ServerLinks
	serverId: string
}) {
	const record = useMutation(api.functions.site.analytics.recordPublicEvent)
	const links = [
		{ label: 'Website', href: props.links.website, icon: LinkSquare01Icon },
		{ label: 'Discord', href: props.links.discordUrl, icon: DiscordIcon },
		{ label: 'Store', href: props.links.storeUrl, icon: LinkSquare01Icon },
		{ label: 'Wiki', href: props.links.wikiUrl, icon: LinkSquare01Icon },
	].flatMap((link) =>
		link.href ? [{ ...link, href: ensureUrl(link.href) }] : [],
	)

	if (links.length === 0) {
		return null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Links</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{links.map((link) => (
					<Button
						className="w-full justify-start"
						key={link.label}
						nativeButton={false}
						onClick={() =>
							record({
								targetType: 'server',
								targetId: props.serverId,
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
						<HugeiconsIcon className="size-4" icon={link.icon} />
						{link.label}
					</Button>
				))}
			</CardContent>
		</Card>
	)
}
