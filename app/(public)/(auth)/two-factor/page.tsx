import { redirect } from 'next/navigation'
import { TwoFactorChallenge } from '@/components/ba-ui/two-factor/two-factor-challenge'
import { isAuthenticated } from '@/lib/auth-server'

/** Second step of logging in, for accounts with two-factor turned on. */
export default async function TwoFactor() {
	const authenticated = await isAuthenticated()

	if (authenticated) {
		redirect('/dashboard')
	}

	return (
		<div className="container mx-auto flex items-center justify-center p-4">
			<div className="flex w-full max-w-md justify-center">
				<TwoFactorChallenge />
			</div>
		</div>
	)
}
