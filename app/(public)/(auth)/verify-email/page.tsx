import { Suspense } from 'react'
import { VerifyEmail as VerifyEmailCard } from '@/components/ba-ui/auth/verify-email'
import { Spinner } from '@/components/ui/spinner'

function VerifyEmailFallback() {
	return (
		<div className="flex min-h-48 items-center justify-center">
			<Spinner className="size-5" />
		</div>
	)
}

export default function VerifyEmail() {
	return (
		<div className="container mx-auto flex items-center justify-center p-4">
			<div className="flex w-full max-w-md justify-center">
				<Suspense fallback={<VerifyEmailFallback />}>
					<VerifyEmailCard />
				</Suspense>
			</div>
		</div>
	)
}
