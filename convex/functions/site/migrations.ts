import { createFunctionHandle } from 'convex/server'
import { v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import {
	type ActionCtx,
	internalAction,
	internalMutation,
} from '../../_generated/server'
import { recordActivity, recordReleaseActivity } from '../../lib/activity'
import { isPublicProject, isPublicServer } from '../../lib/contentVisibility'
import { syncCreatorListing } from '../../lib/creatorListings'
import { parseImageDataUrl } from '../../lib/dataUrls'
import {
	ensureProjectStats,
	ensureServerStats,
	syncProject,
	syncServer,
} from '../../lib/discovery'
import { isPublicRelease } from '../../lib/projectReleases'
import { cdnR2, getCdnObjectUrl } from '../../lib/r2'
import {
	buildOrganizationMediaR2ObjectKey,
	buildProfileMediaR2ObjectKey,
} from '../../lib/r2Keys'
import { supportedGameVersions } from '../projects/artifactValidation'

const BATCH_SIZE = 500

/**
 * Deletes every row of the retired `analyticsEvents` table in batches,
 * rescheduling itself until the table is empty. Safe to re-run. Once it
 * finishes, remove the table from `convex/schemas/site.ts`.
 *
 * Run: npx convex run functions/site/migrations:purgeAnalyticsEvents
 */
export const purgeAnalyticsEvents = internalMutation({
	args: {},
	handler: async (ctx) => {
		const events = await ctx.db.query('analyticsEvents').take(BATCH_SIZE)
		for (const event of events) {
			await ctx.db.delete(event._id)
		}
		if (events.length === BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.purgeAnalyticsEvents,
				{},
			)
		}
		return { deleted: events.length, done: events.length < BATCH_SIZE }
	},
})

const ACTIVITY_SOURCES = [
	'servers',
	'projects',
	'projectVersions',
	'serverReviews',
	'projectReviews',
] as const

const ACTIVITY_BATCH = 100

/**
 * Creates the public activity feed for content that existed before activity
 * was recorded server-side, using each item's original timestamps. Entries
 * are de-duplicated, so it is safe to re-run.
 *
 * Run: npx convex run functions/site/migrations:backfillActivity
 */
export const backfillActivity = internalMutation({
	args: {
		source: v.optional(
			v.union(
				v.literal('servers'),
				v.literal('projects'),
				v.literal('projectVersions'),
				v.literal('serverReviews'),
				v.literal('projectReviews'),
			),
		),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const source = args.source ?? 'servers'
		const paginationOpts = { cursor: args.cursor ?? null, numItems: ACTIVITY_BATCH }
		let isDone: boolean
		let continueCursor: string

		switch (source) {
			case 'servers': {
				const page = await ctx.db.query('servers').paginate(paginationOpts)
				for (const server of page.page) {
					if (!isPublicServer(server)) continue
					await recordActivity(ctx, {
						userId: server.registeredBy,
						type: 'server_added',
						targetId: server._id,
						targetName: server.name,
						targetSlug: server.slug,
						createdAt: server.publishedAt ?? server._creationTime,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'projects': {
				const page = await ctx.db.query('projects').paginate(paginationOpts)
				for (const project of page.page) {
					if (!isPublicProject(project)) continue
					await recordActivity(ctx, {
						userId: project.createdBy,
						type: 'project_added',
						targetId: project._id,
						targetName: project.name,
						targetSlug: project.slug,
						createdAt: project.publishedAt ?? project._creationTime,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'projectVersions': {
				const page = await ctx.db.query('projectVersions').paginate(paginationOpts)
				for (const release of page.page) {
					if (!isPublicRelease(release)) continue
					const project = await ctx.db.get(release.projectId)
					if (!project || !isPublicProject(project)) continue
					await recordReleaseActivity(
						ctx,
						project,
						release,
						release.publishedAt ?? release.createdAt,
					)
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'serverReviews': {
				const page = await ctx.db.query('serverReviews').paginate(paginationOpts)
				for (const review of page.page) {
					if (!review.isActive) continue
					const server = await ctx.db.get(review.serverId)
					if (!server || !isPublicServer(server)) continue
					await recordActivity(ctx, {
						userId: review.userId,
						type: 'review_added',
						targetId: server._id,
						targetName: server.name,
						targetSlug: server.slug,
						metadata: { rating: review.rating, targetType: 'server' },
						createdAt: review.createdAt,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'projectReviews': {
				const page = await ctx.db.query('projectReviews').paginate(paginationOpts)
				for (const review of page.page) {
					if (!review.isActive) continue
					const project = await ctx.db.get(review.projectId)
					if (!project || !isPublicProject(project)) continue
					await recordActivity(ctx, {
						userId: review.userId,
						type: 'review_added',
						targetId: project._id,
						targetName: project.name,
						targetSlug: project.slug,
						metadata: { rating: review.rating, targetType: 'project' },
						createdAt: review.createdAt,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
		}

		const nextSource = ACTIVITY_SOURCES[ACTIVITY_SOURCES.indexOf(source) + 1]
		if (!isDone) {
			await ctx.scheduler.runAfter(0, internal.functions.site.migrations.backfillActivity, {
				source,
				cursor: continueCursor,
			})
		} else if (nextSource) {
			await ctx.scheduler.runAfter(0, internal.functions.site.migrations.backfillActivity, {
				source: nextSource,
				cursor: null,
			})
		}
		return { source, isDone }
	},
})

/**
 * Switches the plugin registry's pages on or off from the command line, for
 * deployments where no admin can sign in yet. Everywhere else, use the
 * Plugins toggle in the admin settings, which also records who changed it.
 *
 * Run: npx convex run functions/site/migrations:setPluginsEnabled '{"enabled":true}'
 */
export const setPluginsEnabled = internalMutation({
	args: { enabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'features'))
			.unique()
		const value = {
			...(existing?.value as Record<string, unknown> | undefined),
			pluginsEnabled: args.enabled,
		}
		if (existing) {
			await ctx.db.patch(existing._id, { value, updatedAt: Date.now() })
		} else {
			await ctx.db.insert('siteSettings', {
				key: 'features',
				value,
				description: 'Operational feature flags',
				updatedAt: Date.now(),
			})
		}
		return null
	},
})

const DISCOVERY_BATCH_SIZE = 50

/**
 * Fills in the listing fields kept by lib/discovery.ts for content that
 * existed before they did: public flags, types, publish and release dates,
 * exact save counts, supported Minecraft versions, and search text. New
 * writes maintain all of these themselves. Safe to re-run; it also repairs
 * drift and refreshes search text after categories are renamed.
 *
 * Run: npx convex run functions/site/migrations:backfillDiscovery
 */
export const backfillDiscovery = internalMutation({
	args: {
		source: v.optional(v.union(v.literal('servers'), v.literal('projects'))),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const source = args.source ?? 'servers'
		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: DISCOVERY_BATCH_SIZE,
		}
		let isDone: boolean
		let continueCursor: string

		if (source === 'servers') {
			const page = await ctx.db.query('servers').paginate(paginationOpts)
			for (const server of page.page) {
				const saves = await ctx.db
					.query('favourites')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.collect()
				const stats = await ensureServerStats(ctx, server._id)
				if (stats.favouriteCount !== saves.length) {
					await ctx.db.patch(stats._id, { favouriteCount: saves.length })
				}
				await syncServer(ctx, server)
			}
			;({ isDone, continueCursor } = page)
		} else {
			const page = await ctx.db.query('projects').paginate(paginationOpts)
			for (const project of page.page) {
				const saves = await ctx.db
					.query('favourites')
					.withIndex('by_project', (q) => q.eq('projectId', project._id))
					.collect()
				const stats = await ensureProjectStats(ctx, project._id)
				if (stats.favouriteCount !== saves.length) {
					await ctx.db.patch(stats._id, { favouriteCount: saves.length })
				}

				const releases = await ctx.db
					.query('projectVersions')
					.withIndex('by_project', (q) => q.eq('projectId', project._id))
					.order('desc')
					.collect()
				const versions = supportedGameVersions(releases.filter(release => isPublicRelease(release, project.type)))
				if (versions.join('\n') !== (project.supportedGameVersions ?? []).join('\n')) {
					await ctx.db.patch(project._id, { supportedGameVersions: versions })
				}
				await syncProject(ctx, project)
			}
			;({ isDone, continueCursor } = page)
		}

		if (!isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillDiscovery,
				{ source, cursor: continueCursor },
			)
		} else if (source === 'servers') {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillDiscovery,
				{ source: 'projects', cursor: null },
			)
		}
		return null
	},
})

const CREATOR_LISTING_SOURCES = ['servers', 'projects', 'plugins'] as const
const CREATOR_LISTING_BATCH = 25

/**
 * Builds the search listings kept by lib/creatorListings.ts for creators and
 * organizations whose content existed before those listings did. New writes
 * maintain them. Safe to re-run; it also repairs drift.
 *
 * Run: npx convex run functions/site/migrations:backfillCreatorListings
 */
export const backfillCreatorListings = internalMutation({
	args: {
		source: v.optional(
			v.union(
				v.literal('servers'),
				v.literal('projects'),
				v.literal('plugins'),
			),
		),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const source = args.source ?? 'servers'
		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: CREATOR_LISTING_BATCH,
		}
		// `type:id` keys, so an owner of several items is rebuilt once.
		const owners = new Set<string>()
		let isDone: boolean
		let continueCursor: string

		if (source === 'servers') {
			const page = await ctx.db.query('servers').paginate(paginationOpts)
			for (const server of page.page) {
				owners.add(`user:${server.registeredBy}`)
				if (server.ownerType === 'organization') {
					owners.add(`organization:${server.ownerId}`)
				}
			}
			;({ isDone, continueCursor } = page)
		} else {
			const page = await ctx.db.query(source).paginate(paginationOpts)
			for (const item of page.page) {
				owners.add(`${item.ownerType}:${item.ownerId}`)
			}
			;({ isDone, continueCursor } = page)
		}

		for (const key of owners) {
			const separator = key.indexOf(':')
			await syncCreatorListing(
				ctx,
				key.slice(0, separator) as 'user' | 'organization',
				key.slice(separator + 1),
			)
		}

		const nextSource =
			CREATOR_LISTING_SOURCES[CREATOR_LISTING_SOURCES.indexOf(source) + 1]
		if (!isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillCreatorListings,
				{ source, cursor: continueCursor },
			)
		} else if (nextSource) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillCreatorListings,
				{ source: nextSource, cursor: null },
			)
		}
		return null
	},
})

const pictureOwnerValidator = v.union(
	v.literal('user'),
	v.literal('organization'),
)
// Rows holding an inline picture are tens of kilobytes each.
const INLINE_PICTURE_BATCH = 10

/** `user.image` or `organization.logo`, whichever the owner has. */
async function readOwnerPicture(
	ctx: Pick<ActionCtx, 'runQuery'>,
	ownerType: 'user' | 'organization',
	ownerId: string,
) {
	const owner = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: ownerType,
		where: [{ field: '_id', value: ownerId }],
	})) as { image?: string | null; logo?: string | null } | null
	return (ownerType === 'user' ? owner?.image : owner?.logo) ?? null
}

/**
 * Moves avatars and organization logos that were saved inline as data URLs
 * into R2 and leaves their CDN URL in their place (lib/ownerPictures.ts). New
 * uploads go to R2 directly. Safe to re-run: only accounts still holding a
 * data URL are touched, and a picture that cannot be decoded is logged and
 * left as it is.
 *
 * Run: npx convex run functions/site/migrations:backfillInlinePictures
 */
export const backfillInlinePictures = internalMutation({
	args: {
		ownerType: v.optional(pictureOwnerValidator),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const ownerType = args.ownerType ?? 'user'
		const page = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: ownerType,
			paginationOpts: {
				cursor: args.cursor ?? null,
				numItems: INLINE_PICTURE_BATCH,
			},
		})) as {
			page: Array<{ _id: string; image?: string | null; logo?: string | null }>
			isDone: boolean
			continueCursor: string
		}

		for (const owner of page.page) {
			const picture = ownerType === 'user' ? owner.image : owner.logo
			if (picture?.startsWith('data:')) {
				await ctx.scheduler.runAfter(
					0,
					internal.functions.site.migrations.moveInlinePicture,
					{ ownerType, ownerId: owner._id },
				)
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillInlinePictures,
				{ ownerType, cursor: page.continueCursor },
			)
		} else if (ownerType === 'user') {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.backfillInlinePictures,
				{ ownerType: 'organization', cursor: null },
			)
		}
		return null
	},
})

/** Uploads one owner's inline picture to R2; see backfillInlinePictures. */
export const moveInlinePicture = internalAction({
	args: { ownerType: pictureOwnerValidator, ownerId: v.string() },
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const picture = await readOwnerPicture(ctx, args.ownerType, args.ownerId)
		if (!picture?.startsWith('data:')) {
			return null
		}
		const image = parseImageDataUrl(picture)
		if (!image) {
			console.warn(
				`The inline picture of ${args.ownerType} ${args.ownerId} is not a PNG, JPG, WebP or GIF; left as it is`,
			)
			return null
		}
		const key =
			args.ownerType === 'user'
				? buildProfileMediaR2ObjectKey({
						userId: args.ownerId,
						mediaKind: 'avatar',
						fileName: `avatar.${image.extension}`,
					})
				: buildOrganizationMediaR2ObjectKey({
						organizationId: args.ownerId,
						mediaKind: 'logo',
						fileName: `logo.${image.extension}`,
					})
		if (!getCdnObjectUrl(key)) {
			throw new Error('R2_CDN_PUBLIC_URL is not configured')
		}
		await cdnR2.store(ctx, image.bytes, { key, type: image.contentType })
		await ctx.runMutation(
			internal.functions.site.migrations.saveMovedPicture,
			{ ...args, key, inlineLength: picture.length },
		)
		return null
	},
})

/** Points the owner at their uploaded picture; see backfillInlinePictures. */
export const saveMovedPicture = internalMutation({
	args: {
		ownerType: pictureOwnerValidator,
		ownerId: v.string(),
		key: v.string(),
		inlineLength: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const url = getCdnObjectUrl(args.key)
		const current = await readOwnerPicture(ctx, args.ownerType, args.ownerId)
		// The owner changed or removed the picture while it was uploading.
		if (
			!url ||
			!current?.startsWith('data:') ||
			current.length !== args.inlineLength
		) {
			await cdnR2.deleteObject(ctx, args.key)
			return null
		}
		// The handle runs the triggers in auth.ts, which check the upload and
		// add the picture to the owner's search listing.
		const onUpdateHandle = await createFunctionHandle(internal.auth.onUpdate)
		const where = [{ field: '_id' as const, value: args.ownerId }]
		if (args.ownerType === 'user') {
			await ctx.runMutation(components.betterAuth.adapter.updateOne, {
				input: { model: 'user', where, update: { image: url } },
				onUpdateHandle,
			})
		} else {
			await ctx.runMutation(components.betterAuth.adapter.updateOne, {
				input: { model: 'organization', where, update: { logo: url } },
				onUpdateHandle,
			})
		}
		return null
	},
})
