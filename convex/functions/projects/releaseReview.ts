import { ConvexError, v } from 'convex/values'
import { api } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { action, type QueryCtx } from '../../_generated/server'
import { moderatorQuery } from '../../lib/functions'
import { cdnR2, uploadsR2 } from '../../lib/r2'
import { isPublicRelease } from '../../lib/projectReleases'
import { compareFiles } from '../../lib/projectVersionFiles'

const change = v.union(
	v.literal('added'),
	v.literal('changed'),
	v.literal('removed'),
)

async function filesOf(ctx: QueryCtx, version: Doc<'projectVersions'>) {
	return ctx.db
		.query('projectVersionFiles')
		.withIndex('by_versionId', (q) => q.eq('versionId', version._id))
		.unique()
}

/** The newest public release older than `version`. */
async function previousRelease(ctx: QueryCtx, version: Doc<'projectVersions'>) {
	for await (const candidate of ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', version.projectId))
		.order('desc')) {
		if (
			candidate._id !== version._id &&
			candidate.createdAt < version.createdAt &&
			isPublicRelease(candidate)
		) {
			return candidate
		}
	}
	return null
}

/**
 * The files in a release compared with the version people download today,
 * for the moderator reviewing it. Lists exist only for releases checked by
 * validator checks version 1 or later.
 */
export const getFileChanges = moderatorQuery({
	args: { versionId: v.id('projectVersions') },
	returns: v.union(
		v.null(),
		v.object({
			listed: v.boolean(),
			previousVersion: v.optional(v.string()),
			previousListed: v.boolean(),
			truncated: v.boolean(),
			fileCount: v.number(),
			added: v.number(),
			changed: v.number(),
			removed: v.number(),
			unchanged: v.number(),
			rows: v.array(
				v.object({ path: v.string(), change, size: v.number() }),
			),
			rowsTruncated: v.boolean(),
		}),
	),
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version) return null
		const files = await filesOf(ctx, version)
		const previous = await previousRelease(ctx, version)
		const previousFiles = previous ? await filesOf(ctx, previous) : null
		const empty = {
			added: 0,
			changed: 0,
			removed: 0,
			unchanged: 0,
			rows: [],
			rowsTruncated: false,
		}
		const base = {
			listed: Boolean(files),
			previousVersion: previous?.version,
			previousListed: Boolean(previousFiles),
			truncated: Boolean(files?.truncated || previousFiles?.truncated),
			fileCount: files?.files.length ?? 0,
		}
		if (!files || (previous && !previousFiles)) return { ...base, ...empty }
		return { ...base, ...compareFiles(previousFiles?.files ?? [], files.files) }
	},
})

const DOWNLOAD_LINK_SECONDS = 10 * 60

/** Where a release's file is stored, for a moderator's download. */
export const getReleaseFile = moderatorQuery({
	args: { versionId: v.id('projectVersions') },
	returns: v.union(
		v.null(),
		v.object({ bucket: v.union(v.literal('uploads'), v.literal('cdn')), key: v.string() }),
	),
	handler: async (ctx, args) => {
		const version = await ctx.db.get(args.versionId)
		if (!version) return null
		if (version.uploadR2Key) return { bucket: 'uploads' as const, key: version.uploadR2Key }
		return { bucket: 'cdn' as const, key: version.cdnR2Key ?? version.r2Key }
	},
})

/** A short-lived link to a release's file, for the moderator reviewing it. */
export const getReleaseDownloadUrl = action({
	args: { versionId: v.id('projectVersions') },
	returns: v.string(),
	handler: async (ctx, args): Promise<string> => {
		const file: { bucket: 'uploads' | 'cdn'; key: string } | null =
			await ctx.runQuery(api.functions.projects.releaseReview.getReleaseFile, args)
		if (!file) {
			throw new ConvexError('This version has no file to download.')
		}
		const bucket = file.bucket === 'uploads' ? uploadsR2 : cdnR2
		return bucket.getUrl(file.key, { expiresIn: DOWNLOAD_LINK_SECONDS })
	},
})
