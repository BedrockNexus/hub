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

export interface OwnerOrganizationBase {
	type: 'organization'
	name: string
	slug: string
	logo?: string | null
}

interface OrganizationOwnerCardBaseProps {
	owner: OwnerOrganizationBase
	organizationHref: (slug: string) => string
	title?: string
	description?: string
	headerBadgeLabel?: string
	orgBadgeLabel?: string
}

export function OrganizationOwnerCardBase({
	owner,
	organizationHref,
	title = 'Creators',
}: OrganizationOwnerCardBaseProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<Item
					render={<Link href={organizationHref(owner.slug)} />}
					size="xs"
					variant="outline"
				>
					<ItemMedia>
						<UserAvatarImage
							avatarClassName="size-11"
							image={owner.logo}
							size={44}
							username={owner.name}
						/>
					</ItemMedia>
					<ItemContent className="min-w-0">
						<ItemTitle className="max-w-full">
							{owner.name}
						</ItemTitle>
						<ItemDescription>Organization</ItemDescription>
					</ItemContent>
				</Item>
			</CardContent>
		</Card>
	)
}
