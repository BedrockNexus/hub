import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isPublicPlugin, isPublicProject } from './contentVisibility'
import { isPublicRelease } from './projectReleases'
import type { PackDependency, ReleasePack } from './projectVersionFiles'
import { summarizeTarget, type TargetSummary } from './targetSummaries'

/**
 * Structured release dependencies (roadmap Phase 3).
 *
 * - `creator` rows: declared by the publisher: a BedrockNexus add-on,
 *   resource pack or plugin, or an external link.
 * - `manifest` rows: pack UUIDs the release's manifests depend on, recorded
 *   by the validator. They resolve to a listing when read, so a dependency
 *   published later still links up.
 *
 * A pack UUID belongs to the listing that published it first, so a copy
 * re-uploaded by someone else never takes over another creator's links.
 */

const MAX_DECLARED = 20
const MAX_NAME = 80
const MAX_URL = 300
const MAX_REF = 64

export const dependencyKind = v.union(
	v.literal('required'),
	v.literal('optional'),
	v.literal('incompatible'),
)

/** What a publisher sends: a listing by ID, or an external name and link. */
export const declaredDependencyValidator = v.object({
	kind: dependencyKind,
	projectId: v.optional(v.string()),
	pluginId: v.optional(v.string()),
	externalName: v.optional(v.string()),
	externalUrl: v.optional(v.string()),
})

export type DeclaredDependency = typeof declaredDependencyValidator.type

type Ctx = QueryCtx | MutationCtx

// =============================================================================
// WRITING
// =============================================================================

/** Replaces a release's packs and manifest dependencies (validation result). */
export async function saveReleasePacks(
	ctx: MutationCtx,
	version: Doc<'projectVersions'>,
	packs: ReleasePack[],
	dependencies: PackDependency[],
) {
	for (const row of await ctx.db
		.query('releasePacks')
		.withIndex('by_versionId', (q) => q.eq('versionId', version._id))
		.take(200)) {
		await ctx.db.delete(row._id)
	}
	for (const pack of packs) {
		await ctx.db.insert('releasePacks', {
			versionId: version._id,
			projectId: version.projectId,
			uuid: pack.uuid,
			version: pack.version,
			kind: pack.kind,
		})
	}
	for (const row of await releaseDependencyRows(ctx, version._id)) {
		if (row.source === 'manifest') await ctx.db.delete(row._id)
	}
	for (const dependency of dependencies) {
		await ctx.db.insert('releaseDependencies', {
			versionId: version._id,
			projectId: version.projectId,
			kind: 'required',
			source: 'manifest',
			packUuid: dependency.uuid,
			packVersion: dependency.version,
		})
	}
}

function cleanUrl(value: string) {
	let url: URL
	try {
		url = new URL(value.trim())
	} catch {
		throw new ConvexError('Dependency links must be full https:// addresses')
	}
	if (url.protocol !== 'https:' || value.length > MAX_URL) {
		throw new ConvexError('Dependency links must be full https:// addresses')
	}
	return url.toString()
}

/** Checks and normalizes what a publisher declared; throws on bad input. */
export async function checkDeclaredDependencies(
	ctx: Ctx,
	projectId: Id<'projects'>,
	declared: DeclaredDependency[],
) {
	if (declared.length > MAX_DECLARED) {
		throw new ConvexError(`A release can list at most ${MAX_DECLARED} dependencies`)
	}
	const seen = new Set<string>()
	const rows: Omit<Doc<'releaseDependencies'>, '_id' | '_creationTime' | 'versionId' | 'projectId'>[] = []
	for (const item of declared) {
		const base = { kind: item.kind, source: 'creator' as const }
		if (item.projectId) {
			const id =
				item.projectId.length <= MAX_REF
					? ctx.db.normalizeId('projects', item.projectId)
					: null
			const project = id ? await ctx.db.get(id) : null
			if (!project || !isPublicProject(project)) {
				throw new ConvexError('A dependency is not a public add-on or resource pack')
			}
			if (project._id === projectId) {
				throw new ConvexError('A release cannot depend on its own listing')
			}
			if (seen.has(project._id)) continue
			seen.add(project._id)
			rows.push({ ...base, dependencyProjectId: project._id })
		} else if (item.pluginId) {
			const id =
				item.pluginId.length <= MAX_REF
					? ctx.db.normalizeId('plugins', item.pluginId)
					: null
			const plugin = id ? await ctx.db.get(id) : null
			if (!plugin || !isPublicPlugin(plugin)) {
				throw new ConvexError('A dependency is not a public plugin')
			}
			if (seen.has(plugin._id)) continue
			seen.add(plugin._id)
			rows.push({ ...base, dependencyPluginId: plugin._id })
		} else {
			const name = item.externalName?.trim().replace(/\s+/g, ' ')
			if (!name || name.length > MAX_NAME) {
				throw new ConvexError(`Name each external dependency (up to ${MAX_NAME} characters)`)
			}
			const url = item.externalUrl?.trim() ? cleanUrl(item.externalUrl) : undefined
			const key = `external:${name.toLowerCase()}`
			if (seen.has(key)) continue
			seen.add(key)
			rows.push({ ...base, externalName: name, externalUrl: url })
		}
	}
	return rows
}

/** Replaces the publisher-declared dependencies of a release. */
export async function saveDeclaredDependencies(
	ctx: MutationCtx,
	version: Doc<'projectVersions'>,
	declared: DeclaredDependency[],
) {
	const rows = await checkDeclaredDependencies(ctx, version.projectId, declared)
	for (const row of await releaseDependencyRows(ctx, version._id)) {
		if (row.source === 'creator') await ctx.db.delete(row._id)
	}
	for (const row of rows) {
		await ctx.db.insert('releaseDependencies', {
			...row,
			versionId: version._id,
			projectId: version.projectId,
		})
	}
}

// =============================================================================
// READING
// =============================================================================

async function releaseDependencyRows(ctx: Ctx, versionId: Id<'projectVersions'>) {
	return ctx.db
		.query('releaseDependencies')
		.withIndex('by_versionId', (q) => q.eq('versionId', versionId))
		.take(200)
}

/**
 * The public listing that first published a pack UUID, other than
 * `excludeProjectId`. Null when no public release contains it.
 */
export async function projectForPackUuid(
	ctx: Ctx,
	uuid: string,
	excludeProjectId?: Id<'projects'>,
): Promise<Doc<'projects'> | null> {
	const rows = await ctx.db
		.query('releasePacks')
		.withIndex('by_uuid', (q) => q.eq('uuid', uuid))
		.take(50)
	// Oldest first: _creationTime order within the index.
	for (const row of rows) {
		if (row.projectId === excludeProjectId) continue
		const [release, project] = await Promise.all([
			ctx.db.get(row.versionId),
			ctx.db.get(row.projectId),
		])
		if (release && isPublicRelease(release) && project && isPublicProject(project)) {
			return project
		}
	}
	return null
}

export interface ResolvedDependency {
	kind: Doc<'releaseDependencies'>['kind']
	/** `manifest`: read from the pack; `creator`: declared by the publisher. */
	source: Doc<'releaseDependencies'>['source']
	listing: TargetSummary | null
	externalName?: string
	externalUrl?: string
	/** A pack the manifest needs that is not on BedrockNexus. */
	packUuid?: string
	packVersion?: string
}

/** A release's dependencies for display, with manifest rows resolved. */
export async function listReleaseDependencies(
	ctx: QueryCtx,
	version: Doc<'projectVersions'>,
): Promise<ResolvedDependency[]> {
	const rows = await releaseDependencyRows(ctx, version._id)
	const declared = new Set(
		rows.flatMap((row) =>
			row.source === 'creator' && row.dependencyProjectId
				? [row.dependencyProjectId]
				: [],
		),
	)
	const result: ResolvedDependency[] = []
	for (const row of rows) {
		if (row.dependencyProjectId || row.dependencyPluginId) {
			const listing = await summarizeTarget(
				ctx,
				row.dependencyProjectId
					? { targetType: 'project', targetId: row.dependencyProjectId }
					: { targetType: 'plugin', targetId: row.dependencyPluginId as string },
			)
			// A listing that went private is left out rather than shown blank.
			if (listing) result.push({ kind: row.kind, source: row.source, listing })
			continue
		}
		if (row.packUuid) {
			const project = await projectForPackUuid(ctx, row.packUuid, version.projectId)
			// Declared by the creator as well: show it once.
			if (project && declared.has(project._id)) continue
			if (project) declared.add(project._id)
			result.push({
				kind: row.kind,
				source: row.source,
				listing: project
					? await summarizeTarget(ctx, { targetType: 'project', targetId: project._id })
					: null,
				packUuid: project ? undefined : row.packUuid,
				packVersion: row.packVersion,
			})
			continue
		}
		result.push({
			kind: row.kind,
			source: row.source,
			listing: null,
			externalName: row.externalName,
			externalUrl: row.externalUrl,
		})
	}
	return result
}

/** The publisher-declared dependencies, in the shape the release form edits. */
export async function listDeclaredDependencies(
	ctx: QueryCtx,
	versionId: Id<'projectVersions'>,
) {
	const rows = await releaseDependencyRows(ctx, versionId)
	return Promise.all(
		rows
			.filter((row) => row.source === 'creator')
			.map(async (row) => ({
				kind: row.kind,
				projectId: row.dependencyProjectId,
				pluginId: row.dependencyPluginId,
				externalName: row.externalName,
				externalUrl: row.externalUrl,
				listing:
					row.dependencyProjectId || row.dependencyPluginId
						? await summarizeTarget(
								ctx,
								row.dependencyProjectId
									? { targetType: 'project', targetId: row.dependencyProjectId }
									: { targetType: 'plugin', targetId: row.dependencyPluginId as string },
							)
						: null,
			})),
	)
}

/**
 * Listings whose newest public release depends on the project, through a
 * declared dependency or one of its pack UUIDs. Bounded; used to tell their
 * owners about breaking releases.
 */
export async function dependentProjects(
	ctx: QueryCtx,
	projectId: Id<'projects'>,
): Promise<Doc<'projects'>[]> {
	const versionIds = new Set<Id<'projectVersions'>>()
	for (const row of await ctx.db
		.query('releaseDependencies')
		.withIndex('by_dependencyProjectId', (q) => q.eq('dependencyProjectId', projectId))
		.take(500)) {
		if (row.kind !== 'incompatible') versionIds.add(row.versionId)
	}
	const packs = await ctx.db
		.query('releasePacks')
		.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
		.take(200)
	for (const uuid of new Set(packs.map((pack) => pack.uuid))) {
		// Only when this project really owns the UUID.
		const owner = await projectForPackUuid(ctx, uuid)
		if (owner?._id !== projectId) continue
		for (const row of await ctx.db
			.query('releaseDependencies')
			.withIndex('by_packUuid', (q) => q.eq('packUuid', uuid))
			.take(500)) {
			versionIds.add(row.versionId)
		}
	}
	const projects = new Map<Id<'projects'>, Doc<'projects'>>()
	for (const versionId of versionIds) {
		const release = await ctx.db.get(versionId)
		if (!release || release.projectId === projectId || projects.has(release.projectId)) {
			continue
		}
		const project = await ctx.db.get(release.projectId)
		// Only the dependent's current release matters.
		if (project && isPublicProject(project) && project.latestVersionId === release._id) {
			projects.set(project._id, project)
		}
	}
	return [...projects.values()]
}
