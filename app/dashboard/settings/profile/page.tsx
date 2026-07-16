import { UserProfile } from '@/components/ba-ui/settings/user-profile'
import { ExtendedProfileForm } from '@/components/user-dashboard/profile/extended-profile-form'
export default function ProfilePage() {
	return (
		<div className="space-y-4">
			<UserProfile />
			<ExtendedProfileForm />
		</div>
	)
}
