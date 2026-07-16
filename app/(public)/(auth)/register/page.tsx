import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SignUp } from '@/components/ba-ui/auth/sign-up'
import { Button } from '@/components/ui/button'
import { isAuthenticated } from '@/lib/auth-server'
import { getSiteFeatures } from '@/lib/site-settings'

export default async function Register() {
	const [authenticated, features] = await Promise.all([
		isAuthenticated(),
		getSiteFeatures(),
	])

	if (authenticated) {
		redirect('/dashboard')
	}

	if (!features.registrationEnabled) {
		return (
			<div className="container mx-auto flex items-center justify-center p-4">
				<div className="w-full max-w-md space-y-4 text-center">
					<h1 className="font-semibold text-2xl">
						Registration is closed
					</h1>
					<p className="text-muted-foreground">
						New account registration is temporarily unavailable.
						Existing members can still log in.
					</p>
					<Button render={<Link href="/login" />}>Go to login</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto flex items-center justify-center p-4">
			<div className="flex w-full max-w-md justify-center">
				<SignUp />
			</div>
		</div>
	)
}
