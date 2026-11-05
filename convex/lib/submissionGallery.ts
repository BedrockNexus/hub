import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { assertSubmissionEditable, snapshot } from './submissions'
import { MAX_GALLERY_IMAGES } from './gallery'

export async function stageGallery(
	ctx: MutationCtx,
	id: Id<'projects'> | Id<'servers'> | Id<'plugins'>,
) {
	const item = await ctx.db.get(id)
	if (!item) throw new Error('Content not found')
	assertSubmissionEditable(item)
	if ('repositoryId' in item) {
		for (const status of ['preparing', 'inReview', 'publishing'] as const) {
			if (
				await ctx.db
					.query('pluginReleases')
					.withIndex('by_project_id_and_status', (q) =>
						q.eq('projectId', item._id).eq('status', status),
					)
					.first()
			)
				throw new Error(
					'This submission is awaiting review. Its gallery is locked.',
				)
		}
	}
	if (!item.publishedAt && item.status !== 'published') return
	const rows = item.publishedGalleryJson
		? undefined
		: 'repositoryId' in item
			? await ctx.db
					.query('pluginGallery')
					.withIndex('by_plugin_sort', (q) =>
						q.eq('pluginId', item._id),
					)
					.take(MAX_GALLERY_IMAGES + 1)
			: 'smallDescription' in item
				? await ctx.db
						.query('serverGallery')
						.withIndex('by_server_sort', (q) =>
							q.eq('serverId', item._id),
						)
						.take(MAX_GALLERY_IMAGES + 1)
				: await ctx.db
						.query('projectGallery')
						.withIndex('by_project_sort', (q) =>
							q.eq('projectId', item._id),
						)
						.take(MAX_GALLERY_IMAGES + 1)
	await ctx.db.patch(id, {
		...(rows ? { publishedGalleryJson: JSON.stringify(rows) } : {}),
		draftChangesJson: item.draftChangesJson ?? snapshot(item),
		submissionRevision: (item.submissionRevision ?? 0) + 1,
	})
}
export function publicGallery<T>(
	item: { publishedGalleryJson?: string },
	rows: T[],
): T[] {
	return item.publishedGalleryJson
		? (JSON.parse(item.publishedGalleryJson) as T[])
		: rows
}
export async function isRetainedGalleryKey(
	ctx: MutationCtx,
	id: Id<'projects'> | Id<'servers'> | Id<'plugins'>,
	key: string,
) {
	const item = await ctx.db.get(id)
	return Boolean(
		item?.publishedGalleryJson &&
			(JSON.parse(item.publishedGalleryJson) as { r2Key: string }[]).some(
				(row) => row.r2Key === key,
			),
	)
}
