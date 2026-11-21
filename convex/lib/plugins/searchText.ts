/**
 * Plugin search text: name, summary and the start of the description.
 *
 * Capped like project and server search text (lib/discovery.ts). The full
 * description already lives in `description`; copying all of it here doubled
 * every plugin document, and every listing read pays for document size.
 */
export const PLUGIN_SEARCH_TEXT_MAX = 2000

export function pluginSearchText(fields: {
	name: string
	summary: string
	description?: string
}): string {
	return `${fields.name} ${fields.summary} ${fields.description ?? ''}`
		.trim()
		.slice(0, PLUGIN_SEARCH_TEXT_MAX)
}
