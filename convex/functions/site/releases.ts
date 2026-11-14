import { contentDownloadHref } from '../../../lib/content-routes'
import { projectReference } from '../../../lib/content-reference'
import { v } from 'convex/values'
import { normalizeProjectType } from '../../../lib/project-artifacts'
import { createPluginDashboardId } from '../../../lib/plugins/plugin-dashboard-id'
import type { Doc } from '../../_generated/dataModel'
import { type QueryCtx, query } from '../../_generated/server'
import {
	resolvePluginReference,
	resolveProjectReference,
} from '../../lib/contentReferences'
import { isPublicProject } from '../../lib/contentVisibility'
import { getPublishedReleaseKey, isPublicRelease } from '../../lib/projectReleases'
import {
	listReleaseDependencies,
	projectForPackUuid,
} from '../../lib/releaseDependencies'

// One launcher's installed items in one request; the API enforces the same cap.
const MAX_ITEMS = 100
// Newer releases may still be validating or awaiting review.
const RECENT_RELEASES = 50

const sectionValidator = v.union(
	v.literal('addons'),
	v.literal('resource-packs'),
	v.literal('plugins'),
)

const CONTENT_TYPE = {
	addons: 'addon',
	'resource-packs': 'resource_pack',
} as const

async function latestContentRelease(
	ctx: QueryCtx,
	section: keyof typeof CONTENT_TYPE,
	reference: string,
) {
	const project = await resolveProjectReference(ctx, reference)
	if (
		!project ||
		!isPublicProject(project) ||
		normalizeProjectType(project.type) !== CONTENT_TYPE[section]
	) {
		return null
	}

	const recent = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', project._id))
		.order('desc')
		.take(RECENT_RELEASES)
	const release = recent.find(
		(item) => isPublicRelease(item) && Boolean(getPublishedReleaseKey(item)),
	)
	return {
		id: project._id as string,
		slug: project.slug,
		release: release
			? {
					version: release.version,
					publishedAt: release.createdAt,
					fileName: release.fileName,
					fileSize: release.fileSize,
					gameVersions: release.gameVersions ?? [],
					minEngineVersion: release.minEngineVersion ?? null,
					breakingChanges: release.breakingChanges === true,
					sha256: release.validationReport?.sha256 ?? null,
					downloadPath: contentDownloadHref(project.type, projectReference(project.type, project._id, project.publicId), release.version),
					dependencies: await apiDependencies(ctx, release),
				}
			: null,
	}
}

/** A release's dependencies as API references (section and ID), not site links. */
async function apiDependencies(ctx: QueryCtx, release: Doc<'projectVersions'>) {
	const resolved = await listReleaseDependencies(ctx, release)
	return Promise.all(
		resolved.map(async (item) => ({
			kind: item.kind,
			source: item.source,
			listing: item.listing
				? await apiReference(ctx, item.listing.targetType, item.listing.targetId)
				: null,
			name: item.listing?.name ?? item.externalName ?? null,
			url: item.externalUrl ?? null,
			packUuid: item.packUuid ?? null,
			packVersion: item.packVersion ?? null,
		})),
	)
}

async function apiReference(
	ctx: QueryCtx,
	targetType: string,
	targetId: string,
): Promise<{ section: 'addons' | 'resource-packs' | 'plugins'; id: string } | null> {
	if (targetType === 'project') {
		const id = ctx.db.normalizeId('projects', targetId)
		const project = id ? await ctx.db.get(id) : null
		if (!project) return null
		return {
			section:
				normalizeProjectType(project.type) === 'addon'
					? 'addons'
					: 'resource-packs',
			id: project._id,
		}
	}
	if (targetType === 'plugin') {
		const id = ctx.db.normalizeId('plugins', targetId)
		const plugin = id ? await ctx.db.get(id) : null
		const repository = plugin
			? await ctx.db.get('githubRepositories', plugin.repositoryId)
			: null
		return repository
			? {
					section: 'plugins',
					id: createPluginDashboardId(repository.githubRepositoryId),
				}
			: null
	}
	return null
}

async function latestPluginRelease(ctx: QueryCtx, reference: string) {
	const plugin = await resolvePluginReference(ctx, reference)
	if (plugin?.visibility !== 'public' || plugin.status !== 'published') {
		return null
	}
	const repository = await ctx.db.get('githubRepositories', plugin.repositoryId)
	if (!repository) {
		return null
	}
	const publicId = createPluginDashboardId(repository.githubRepositoryId)
	const found = { id: publicId, slug: plugin.slug }

	const version: Doc<'pluginVersions'> | null = plugin.latestVersionId
		? await ctx.db.get('pluginVersions', plugin.latestVersionId)
		: null
	if (version?.status !== 'published') {
		return { ...found, release: null }
	}
	const release = await ctx.db
		.query('pluginReleases')
		.withIndex('by_version_id', (q) => q.eq('versionId', version._id))
		.first()
	const asset =
		release?.status === 'published' &&
		release.cdnKey &&
		release.fileName &&
		release.size !== undefined
			? release
			: null

	return {
		...found,
		release: {
			version: version.version,
			publishedAt: version.publishedAt ?? null,
			fileName: asset?.fileName ?? null,
			fileSize: asset?.size ?? null,
			gameVersions: version.minecraftVersion ? [version.minecraftVersion] : [],
			sha256: asset?.sha256 ?? null,
			downloadPath: asset
				? `/plugins/${publicId}/download/${encodeURIComponent(version.normalizedVersion)}`
				: null,
		},
	}
}

async function pluginsAreEnabled(ctx: QueryCtx) {
	const features = await ctx.db
		.query('siteSettings')
		.withIndex('by_key', (q) => q.eq('key', 'features'))
		.unique()
	return (
		(features?.value as { pluginsEnabled?: boolean } | undefined)
			?.pluginsEnabled === true
	)
}

/**
 * The newest public release of each item, for a launcher checking for updates
 * in one request. Results are in request order; an item that does not exist,
 * is not public, or belongs to another section is null.
 */
export const latest = query({
	args: {
		items: v.array(
			v.object({ section: sectionValidator, reference: v.string() }),
		),
	},
	handler: async (ctx, args) => {
		if (args.items.length > MAX_ITEMS) {
			throw new Error(`At most ${MAX_ITEMS} items can be checked at once`)
		}
		const plugins = args.items.some((item) => item.section === 'plugins')
			? await pluginsAreEnabled(ctx)
			: false

		return await Promise.all(
			args.items.map(async ({ section, reference }) => {
				if (section === 'plugins') {
					return plugins ? await latestPluginRelease(ctx, reference) : null
				}
				return await latestContentRelease(ctx, section, reference)
			}),
		)
	},
})

const MAX_PACKS = 100

/**
 * Which listing each pack UUID belongs to, for a launcher recognising packs
 * already installed on a device. Results are in request order; a UUID no
 * public release contains is null. A UUID belongs to the listing that
 * published it first (lib/releaseDependencies.ts).
 */
export const lookupPacks = query({
	args: { uuids: v.array(v.string()) },
	handler: async (ctx, args) => {
		if (args.uuids.length > MAX_PACKS) {
			throw new Error(`At most ${MAX_PACKS} packs can be looked up at once`)
		}
		return await Promise.all(
			args.uuids.map(async (raw) => {
				const uuid = raw.trim().toLowerCase()
				if (uuid.length !== 36) return null
				const project = await projectForPackUuid(ctx, uuid)
				if (!project) return null
				const reference = await apiReference(ctx, 'project', project._id)
				return reference
					? { ...reference, slug: project.slug, name: project.name }
					: null
			}),
		)
	},
})
