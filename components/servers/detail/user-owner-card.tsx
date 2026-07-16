import { UserOwnerCardBase } from '@/components/owner/user-owner-card-base'

interface OwnerUser {
	type: 'user'
	username?: string
	displayUsername?: string
	image?: string
}

export function UserOwnerCard(props: { owner: OwnerUser }) {
	return (
		<UserOwnerCardBase
			owner={props.owner}
			profileHref={(username) => `/user/${username}`}
		/>
	)
}
