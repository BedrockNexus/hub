import { UserOwnerCardBase } from '@/components/owner/user-owner-card-base'

interface OwnerUser {
	type: 'user'
	username?: string
	displayUsername?: string
	image?: string
}

export function ProjectUserOwnerCard(props: { owner: OwnerUser }) {
	return (
		<UserOwnerCardBase
			owner={props.owner}
			profileHref={(username) => `/user/${encodeURIComponent(username)}`}
			title="Creators"
		/>
	)
}
