import Link from 'next/link'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { SideCard } from '@/components/detail/detail-parts'

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
		<SideCard title="Creator">
			<Link
				className="group -m-1.5 flex min-w-0 items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted"
				href={href}
			>
				<UserAvatarImage
					avatarClassName="size-10"
					image={owner.type === 'user' ? owner.image : owner.logo}
					size={40}
					username={name}
				/>
				<span className="flex min-w-0 flex-col">
					<span className="truncate font-semibold group-hover:underline">
						{name}
					</span>
					<span className="truncate text-muted-foreground text-sm">
						{owner.type === 'user'
							? `@${owner.username}`
							: 'Organization'}
					</span>
				</span>
			</Link>
		</SideCard>
	)
}
