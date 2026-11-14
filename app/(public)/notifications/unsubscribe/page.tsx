import type { Metadata } from 'next'
import { UnsubscribeForm } from '@/components/social/unsubscribe-form'

export const metadata: Metadata = {
	title: 'Stop notification emails',
	robots: { index: false, follow: false },
}

interface UnsubscribePageProps {
	searchParams: Promise<{ token?: string | string[] }>
}

export default async function UnsubscribePage({
	searchParams,
}: UnsubscribePageProps) {
	const { token } = await searchParams
	return (
		<main className="container mx-auto flex max-w-lg flex-1 flex-col gap-4 px-4 py-20">
			<h1 className="font-bold text-3xl">Stop notification emails</h1>
			<UnsubscribeForm token={typeof token === 'string' ? token : ''} />
		</main>
	)
}
