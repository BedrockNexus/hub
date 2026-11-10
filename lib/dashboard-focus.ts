/**
 * Dashboard pages shown without the sidebar, so nothing competes with the
 * one task on screen: the create screens for each kind of listing.
 */
const TRAILING_SLASHES = /\/+$/

const FOCUSED_PATHS = new Set([
	'/dashboard/addons/add',
	'/dashboard/resource-packs/add',
	'/dashboard/servers/add',
	'/dashboard/plugins/new',
])

export function isFocusedDashboardPath(pathname: string) {
	return FOCUSED_PATHS.has(pathname.replace(TRAILING_SLASHES, ''))
}
