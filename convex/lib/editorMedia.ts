import type { MutationCtx } from '../_generated/server'

const EDITOR_MEDIA_URL_PATTERN = /\/api\/r2\/editor-media\/([^\s)"'<>]+)/g

/** R2 keys of editor uploads embedded in markdown via /api/r2/editor-media. */
export function extractEditorMediaKeys(markdown?: string): string[] {
	if (!markdown) return []
	const keys = new Set<string>()
	for (const match of markdown.matchAll(EDITOR_MEDIA_URL_PATTERN)) {
		try {
			keys.add(
				match[1]
					.split('/')
					.map((segment) => decodeURIComponent(segment))
					.join('/'),
			)
		} catch {
			// Invalid encoded URLs are not valid managed references.
		}
	}
	return [...keys]
}

export type EditorMediaSource = 'servers' | 'projects' | 'projectVersions'

/**
 * Records which documents embed which editor uploads, so storage cleanup can
 * check a key without scanning every description. Rows are hints: cleanup
 * re-reads the source document before trusting one. Call this whenever a
 * markdown field that may embed editor media is written.
 */
export async function recordEditorMediaReferences(
	ctx: MutationCtx,
	sourceTable: EditorMediaSource,
	sourceId: string,
	markdown: string | undefined,
) {
	for (const key of extractEditorMediaKeys(markdown)) {
		const existing = await ctx.db
			.query('editorMediaReferences')
			.withIndex('by_key_and_source', (q) =>
				q.eq('key', key).eq('sourceTable', sourceTable).eq('sourceId', sourceId),
			)
			.unique()
		if (!existing) {
			await ctx.db.insert('editorMediaReferences', {
				key,
				sourceTable,
				sourceId,
				createdAt: Date.now(),
			})
		}
	}
}
