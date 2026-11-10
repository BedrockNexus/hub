import { DangerZone } from '@/components/ba-ui/delete-user/danger-zone'
import { ChangeEmail } from '@/components/ba-ui/settings/change-email'
import { ChangePassword } from '@/components/ba-ui/settings/change-password'
import { TwoFactorSettings } from '@/components/ba-ui/two-factor/two-factor-settings'

export default function AccountPage() {
	return (
		<div className="space-y-4">
			<ChangeEmail />
			<ChangePassword />
			<TwoFactorSettings />
			<DangerZone />
		</div>
	)
}
