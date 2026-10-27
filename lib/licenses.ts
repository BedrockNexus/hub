import catalog from './choosealicense.json'

export interface LicenseOption {
	value: string
	label: string
	url?: string
}

export const LICENSE_CATALOG_SOURCE = catalog.source

/**
 * Names, SPDX identifiers and detail URLs from the official Choose a License
 * catalog. The vendored snapshot records its upstream repository revision.
 */
export const LICENSE_OPTIONS: LicenseOption[] = [
	{ value: '', label: 'Not specified' },
	...catalog.licenses.map(({ value, title, url }) => ({
		value,
		label: `${title} (${value})`,
		url,
	})),
]
