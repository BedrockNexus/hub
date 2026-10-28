import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ListingLayout } from '@/components/listings/listing-layout'
import { PluginGrid } from '@/components/plugins/plugin-card'
import { PluginSearchFilters } from '@/components/plugins/plugin-search-filters'
import '@/app/globals.css'

const initial = '?q=home&category=economy&software=pnx&sort=rating&cursor=stale'
function Fixture() {
	const [query, setQuery] = useState(initial)
	return (
		<NuqsTestingAdapter
			hasMemory
			onUrlUpdate={(event) => setQuery(event.queryString)}
			searchParams={initial}
		>
			<ListingLayout title="Plugin filter fixture">
				<PluginSearchFilters
					categories={[
						{ value: 'economy', label: 'Economy' },
						{ value: 'admin', label: 'Administration' },
					]}
					software={[
						{ value: 'pnx', label: 'PowerNukkitX' },
						{ value: 'pmmp', label: 'PocketMine-MP' },
					]}
				/>
				<output aria-label="Fixture query string">{query}</output>
				<PluginGrid
					plugins={[
						{
							slug: 'trade-ledger',
							name: 'Trade Ledger',
							summary: 'Tracks player shops and transactions.',
							categories: [{ slug: 'economy', name: 'Economy' }],
							ratingAverage: 4.6,
							ratingCount: 18,
							software: { slug: 'pnx', name: 'PowerNukkitX' },
							latestVersion: { version: '1.2.0' },
						},
					]}
				/>
			</ListingLayout>
		</NuqsTestingAdapter>
	)
}
const root = document.getElementById('root')
if (root) {
	createRoot(root).render(<Fixture />)
}
