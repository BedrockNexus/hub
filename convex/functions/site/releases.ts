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
					sha256: release.validationReport?.sha256 ?? null,
					downloadPath: contentDownloadHref(project.type, projectReference(project.type, project._id), release.version),
				}
			: null,
	}
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
