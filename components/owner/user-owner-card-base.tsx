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

export interface OwnerUserBase {
	type: 'user'
	username?: string
	displayUsername?: string
	image?: string
}

interface UserOwnerCardBaseProps {
	owner: OwnerUserBase
	profileHref: (username: string) => string
	title?: string
	description?: string
	badgeLabel?: string
	profileCtaLabel?: string
}

export function UserOwnerCardBase({
	owner,
	profileHref,
	title = 'Owner',
}: UserOwnerCardBaseProps) {
	if (!owner.username) {
		return null
	}

	const displayName = owner.displayUsername ?? owner.username

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<Item
					render={<Link href={profileHref(owner.username)} />}
					size="xs"
					variant="outline"
				>
					<ItemMedia>
						<UserAvatarImage
							avatarClassName="size-11"
							image={owner.image}
							size={44}
							username={displayName}
						/>
					</ItemMedia>
					<ItemContent className="min-w-0">
						<ItemTitle className="max-w-full">
							{displayName}
						</ItemTitle>
						<ItemDescription>Owner</ItemDescription>
					</ItemContent>
				</Item>
			</CardContent>
		</Card>
	)
}
