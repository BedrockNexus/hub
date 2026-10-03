import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { internalMutation } from '../_generated/server'
import { recordEditorMediaReferences } from '../lib/editorMedia'
import { EDITOR_MEDIA_BACKFILL_SETTING } from './storage'

const BATCH_SIZE = 100
const SOURCES = ['servers', 'projects', 'projectVersions'] as const

/**
 * Indexes editor uploads embedded in existing descriptions and changelogs,
 * then marks the backfill complete so storage cleanup may delete unused editor
 * media. Safe to re-run.
 *
 * Run: npx convex run functions/storageMigrations:backfillEditorMediaReferences
 */
export const backfillEditorMediaReferences = internalMutation({
	args: {
		source: v.optional(
			v.union(
				v.literal('servers'),
				v.literal('projects'),
				v.literal('projectVersions'),
			),
		),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const source = args.source ?? 'servers'
		const cursor = args.cursor ?? null

		let isDone: boolean
		let continueCursor: string
		if (source === 'servers') {
			const page = await ctx.db
				.query('servers')
				.paginate({ cursor, numItems: BATCH_SIZE })
			for (const server of page.page) {
				await recordEditorMediaReferences(ctx, 'servers', server._id, server.description)
			}
			;({ isDone, continueCursor } = page)
		} else if (source === 'projects') {
			const page = await ctx.db
				.query('projects')
				.paginate({ cursor, numItems: BATCH_SIZE })
			for (const project of page.page) {
				await recordEditorMediaReferences(ctx, 'projects', project._id, project.description)
			}
			;({ isDone, continueCursor } = page)
		} else {
			const page = await ctx.db
				.query('projectVersions')
				.paginate({ cursor, numItems: BATCH_SIZE })
			for (const version of page.page) {
				await recordEditorMediaReferences(
					ctx,
					'projectVersions',
					version._id,
					version.changelog,
				)
			}
			;({ isDone, continueCursor } = page)
		}

		if (!isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.storageMigrations.backfillEditorMediaReferences,
				{ source, cursor: continueCursor },
			)
			return null
		}

		const next = SOURCES[SOURCES.indexOf(source) + 1]
		if (next) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.storageMigrations.backfillEditorMediaReferences,
				{ source: next, cursor: null },
			)
			return null
		}

		const existing = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', EDITOR_MEDIA_BACKFILL_SETTING))
			.unique()
		if (!existing) {
			await ctx.db.insert('siteSettings', {
				key: EDITOR_MEDIA_BACKFILL_SETTING,
				value: true,
				description:
					'Editor media references are indexed; storage cleanup may delete unused editor uploads.',
				updatedAt: Date.now(),
			})
		}
		return null
	},
})
