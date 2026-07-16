import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isAuthenticated } from '@/lib/auth-server'

export default async function CheckEmailPage({
	searchParams,
}: {
	searchParams?: Promise<{ registered?: string }>
}) {
	const authenticated = await isAuthenticated()

	if (authenticated) {
		redirect('/dashboard')
	}

	const params = (await searchParams) ?? {}
	if (params.registered !== '1') {
		redirect('/register')
	}

	return (
		<div className="container mx-auto flex items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Check your email</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-muted-foreground text-sm">
					<p>
						We sent a verification link to your email address. Open
						it to finish setting up your account.
					</p>
					<p>
						Didn&apos;t get it? Check spam or{' '}
						<Link
							className="text-primary underline-offset-4 hover:underline"
							href="/login"
						>
							go back to login
						</Link>
						.
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
