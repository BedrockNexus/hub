'use client'

import { OpenPanel } from '@openpanel/web'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

const PUBLIC_PATH =
	/^\/(addons|resource-packs|plugins|servers|server|creators|organizations|tools)(\/|$)/
const CATALOG_PATH = /^\/(addons|resource-packs|plugins|servers)$/

function isPublicPath(path: string) {
	return path === '/' || PUBLIC_PATH.test(path)
}

/** Anonymous public browsing only. Account pages, query values and replay stay private. */
export function OpenPanelAnalytics({
	clientId,
	apiUrl,
}: {
	clientId: string
	apiUrl: string
}) {
	const pathname = usePathname()
	const search = useSearchParams()
	const client = useRef<OpenPanel | null>(null)
	const query = search.get('q') ?? search.get('query') ?? ''
	useEffect(() => {
		if (!(clientId && isPublicPath(pathname))) {
			return
		}
		if (!client.current) {
			client.current = new OpenPanel({
				clientId,
				apiUrl,
				trackScreenViews: false,
				trackAttributes: true,
				filter: (event) => {
					if (!isPublicPath(window.location.pathname)) {
						return false
					}
					if (event.type === 'track') {
						event.payload.properties = {
							...event.payload.properties,
							__path: `${window.location.origin}${window.location.pathname}`,
							__referrer: document.referrer
								? new URL(document.referrer).origin
								: '',
						}
					}
					return true
				},
			})
		}
		client.current.screenView(`${window.location.origin}${pathname}`)
		if (!(query && CATALOG_PATH.test(pathname))) {
			return
		}
		const timer = setTimeout(() => {
			client.current?.track('catalog_search', {
				section: pathname.slice(1),
				queryLength: query.length,
			})
		}, 600)
		return () => clearTimeout(timer)
	}, [apiUrl, clientId, pathname, query])
	return null
}
