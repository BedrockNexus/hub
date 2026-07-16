import { DangerZone } from '@/components/ba-ui/delete-user/danger-zone'
import { ChangeEmail } from '@/components/ba-ui/settings/change-email'
import { ChangePassword } from '@/components/ba-ui/settings/change-password'

export default function AccountPage() {
	return (
		<div className="space-y-4">
			<ChangeEmail />
			<ChangePassword />
			<DangerZone />
		</div>
	)
}
