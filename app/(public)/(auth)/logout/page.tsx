import { SignOut } from '@/components/ba-ui/auth/sign-out'

export default function LogoutPage() {
	return (
		<div className="container mx-auto flex items-center justify-center p-4">
			<div className="flex min-h-48 w-full max-w-md justify-center">
				<SignOut />
			</div>
		</div>
	)
}
