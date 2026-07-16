import { redirect } from 'next/navigation'
import { SignInUsername } from '@/components/ba-ui/auth/sign-in-username'
import { isAuthenticated } from '@/lib/auth-server'

export default async function Login() {
	const authenticated = await isAuthenticated()

	if (authenticated) {
		redirect('/dashboard')
	}

	return (
		<div className="container mx-auto flex items-center justify-center p-4">
			<div className="flex w-full max-w-md justify-center">
				<SignInUsername />
			</div>
		</div>
	)
}
