import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default async function RepositoriesPage({
	searchParams,
}: {
	searchParams: Promise<{ github?: string; account?: string }>
}) {
	const params = await searchParams
	const query = new URLSearchParams()
	if (params.github) {
		query.set('github', params.github)
	}
	if (params.account) {
		query.set('account', params.account)
	}
	redirect(
		`/dashboard/plugins${query.size > 0 ? `?${query.toString()}` : ''}` as Route,
	)
}
