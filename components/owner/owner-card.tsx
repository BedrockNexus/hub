import Link from 'next/link'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from '@/components/ui/item'

export interface OwnerCardUser {
	type: 'user'
	username?: string
	displayUsername?: string
	image?: string | null
}

export interface OwnerCardOrganization {
	type: 'organization'
	name: string
	slug: string
	logo?: string | null
}

export type OwnerCardOwner = OwnerCardUser | OwnerCardOrganization

/**
 * Who owns a server, project or plugin, linking to their profile or
 * organization page. The same card on every detail page.
 */
export function OwnerCard({
	owner,
}: {
	owner: OwnerCardOwner | null | undefined
}) {
	if (!owner || (owner.type === 'user' && !owner.username)) {
		return null
	}
	const name =
		owner.type === 'user'
			? (owner.displayUsername ?? owner.username ?? '')
			: owner.name
	const href =
		owner.type === 'user'
			? `/user/${encodeURIComponent(owner.username ?? '')}`
			: `/organizations/${encodeURIComponent(owner.slug)}`

	return (
		<Card>
			<CardHeader>
				<CardTitle>Creator</CardTitle>
			</CardHeader>
			<CardContent>
				<Item render={<Link href={href} />} size="xs" variant="outline">
					<ItemMedia>
						<UserAvatarImage
							avatarClassName="size-11"
							image={
								owner.type === 'user' ? owner.image : owner.logo
							}
							size={44}
							username={name}
						/>
					</ItemMedia>
					<ItemContent className="min-w-0">
						<ItemTitle className="max-w-full">{name}</ItemTitle>
						<ItemDescription>
							{owner.type === 'user'
								? `@${owner.username}`
								: 'Organization'}
						</ItemDescription>
					</ItemContent>
				</Item>
			</CardContent>
		</Card>
	)
}
