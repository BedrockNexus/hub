import { redirect } from 'next/navigation'
import { Auth } from '@/components/ba-ui/auth/auth'
import { isAuthenticated } from '@/lib/auth-server'

export default async function ResetPassword() {
	const authenticated = await isAuthenticated()

	if (authenticated) {
		redirect('/dashboard')
	}

	return (
		<div className="container mx-auto flex items-center justify-center p-4">
			<div className="flex w-full max-w-md justify-center">
				<Auth view="resetPassword" />
			</div>
		</div>
	)
}
