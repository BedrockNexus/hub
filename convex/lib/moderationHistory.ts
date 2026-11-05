import type { Infer } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { snapshotField } from '../schemas/moderation'
import { extractEditorMediaKeys } from './editorMedia'
import { MAX_GALLERY_IMAGES } from './gallery'
import { getCdnObjectKey, r2, resolveCdnObjectUrl } from './r2'
import { publicGallery } from './submissionGallery'

export type Content = Doc<'servers'> | Doc<'projects'> | Doc<'plugins'>
export type SnapshotField = Infer<typeof snapshotField>
type Ctx = QueryCtx | MutationCtx
export function contentKind(item: Content) {
	return 'repositoryId' in item
		? ('plugin' as const)
		: 'smallDescription' in item
			? ('server' as const)
			: ('project' as const)
}
type GalleryRow = Pick<Doc<'projectGallery'>, 'r2Key' | 'caption' | 'fileName'>
export async function galleryFor(
	ctx: Ctx,
	item: Content,
): Promise<GalleryRow[]> {
	if ('repositoryId' in item)
		return ctx.db
			.query('pluginGallery')
			.withIndex('by_plugin_sort', (q) => q.eq('pluginId', item._id))
			.take(MAX_GALLERY_IMAGES + 1)
	if ('smallDescription' in item)
		return ctx.db
			.query('serverGallery')
			.withIndex('by_server_sort', (q) => q.eq('serverId', item._id))
			.take(MAX_GALLERY_IMAGES + 1)
	return ctx.db
		.query('projectGallery')
		.withIndex('by_project_sort', (q) => q.eq('projectId', item._id))
		.take(MAX_GALLERY_IMAGES + 1)
}
const LABELS: Record<string, string> = {
	name: 'Name',
	slug: 'URL name',
	summary: 'Summary',
	smallDescription: 'Summary',
	description: 'Description',
	type: 'Content type',
	tags: 'Tags',
	metadata: 'Pack details',
	sourceUrl: 'Source',
	websiteUrl: 'Website',
	website: 'Website',
	issueTrackerUrl: 'Issue tracker',
	issuesUrl: 'Issue tracker',
	wikiUrl: 'Wiki',
	discordUrl: 'Discord',
	donationUrl: 'Donations',
	storeUrl: 'Store',
	license: 'License',
	licenseCustom: 'License notes',
	ipAddress: 'Address',
	port: 'Port',
	region: 'Region',
	language: 'Languages',
	gameVersions: 'Game versions',
}
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical)
	if (value && typeof value === 'object')
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, item]) => [key, canonical(item)]),
		)
	return value
}
function stable(value: unknown): string {
	if (value === undefined || value === null) return ''
	if (typeof value === 'string') return value
	if (Array.isArray(value)) return value.map(stable).join(', ')
	if (typeof value === 'object')
		return JSON.stringify(canonical(value), null, 2)
	return String(value)
}
export async function fieldsFor(
	ctx: Ctx,
	parent: Content,
	details: object,
	gallery: Awaited<ReturnType<typeof galleryFor>>,
	release?: object,
): Promise<SnapshotField[]> {
	const source = details as Record<string, unknown>
	const fields: SnapshotField[] = Object.entries(LABELS).map(
		([key, label]) => {
			const value = source[key]
			return {
				key,
				label,
				kind: key === 'description' ? 'description' : 'text',
				value: stable(Array.isArray(value) ? [...value].sort() : value),
			}
		},
	)
	const categoryIds = (source.categoryIds ?? []) as string[]
	const categories = await Promise.all(
		categoryIds.map(async (value) => {
			if ('repositoryId' in parent) {
				const id = ctx.db.normalizeId('pluginCategories', value)
				return id
					? (await ctx.db.get('pluginCategories', id))?.name
					: undefined
			}
			if ('smallDescription' in parent) {
				const id = ctx.db.normalizeId('serverCategories', value)
				return id
					? (await ctx.db.get('serverCategories', id))?.name
					: undefined
			}
			const id = ctx.db.normalizeId('projectCategories', value)
			return id
				? (await ctx.db.get('projectCategories', id))?.name
				: undefined
		}),
	)
	fields.push({
		key: 'categories',
		label: 'Categories',
		kind: 'text',
		value: categories.filter(Boolean).sort().join(', '),
	})
	if (!('type' in parent)) {
		const softwareId =
			typeof source.softwareId === 'string'
				? ctx.db.normalizeId('serverSoftware', source.softwareId)
				: null
		fields.push({
			key: 'software',
			label: 'Server software',
			kind: 'text',
			value: softwareId
				? ((await ctx.db.get('serverSoftware', softwareId))?.name ??
					softwareId)
				: '',
		})
	}
	for (const [key, label] of [
		['iconR2Key', 'Icon'],
		['logoR2Key', 'Logo'],
		['bannerR2Key', 'Banner'],
		['iconUrl', 'Icon'],
	] as const) {
		const value = source[key]
		fields.push({
			key,
			label,
			kind: 'image',
			value:
				typeof value === 'string' && value
					? (key === 'iconUrl' ? 'url:' : 'key:') + value
					: '',
		})
	}
	fields.push({
		key: 'gallery',
		label: 'Gallery',
		kind: 'gallery',
		value: gallery.length
			? JSON.stringify(
					gallery.map((row) => ({
						key: row.r2Key,
						caption: row.caption ?? '',
						fileName: row.fileName,
					})),
				)
			: '',
	})
	if (release) {
		const row = release as Record<string, unknown>
		const values = Object.fromEntries(
			[
				'version',
				'changelog',
				'fileName',
				'fileSize',
				'size',
				'gameVersions',
				'commitSha',
				'branch',
				'artifactId',
			]
				.filter((key) => row[key] !== undefined)
				.map((key) => [key, row[key]]),
		)
		fields.push({
			key: 'release',
			label: 'Release',
			kind: 'release',
			value: JSON.stringify(values, null, 2),
		})
	}
	return fields
}
export async function baselineRelease(ctx: Ctx, item: Content) {
	if ('repositoryId' in item) {
		const version = item.latestVersionId
			? await ctx.db.get('pluginVersions', item.latestVersionId)
			: null
		return version
			? await ctx.db
					.query('pluginReleases')
					.withIndex('by_version_id', (q) =>
						q.eq('versionId', version._id),
					)
					.first()
			: null
	}
	if ('type' in item && item.latestVersionId)
		return ctx.db.get('projectVersions', item.latestVersionId)
	return null
}
function mediaKeys(fields: SnapshotField[]) {
	const keys = new Set<string>()
	for (const field of fields) {
		if (field.kind === 'image' && field.value.startsWith('key:'))
			keys.add(field.value.slice(4))
		if (field.kind === 'image' && field.value.startsWith('url:')) {
			const key = getCdnObjectKey(field.value.slice(4))
			if (key) keys.add(key)
		}
		if (field.kind === 'gallery' && field.value)
			for (const row of JSON.parse(field.value) as { key: string }[])
				keys.add(row.key)
		if (field.kind === 'release' && field.value) {
			const release = JSON.parse(field.value) as { changelog?: string }
			for (const key of extractEditorMediaKeys(release.changelog))
				keys.add(key)
		}
		if (field.kind === 'description')
			for (const key of extractEditorMediaKeys(field.value)) keys.add(key)
	}
	return keys
}
export async function recordSubmission(
	ctx: MutationCtx,
	args: {
		content: Content
		actorId: string
		revision: number
		details: object
		scope?: 'listing' | 'release'
		release?: Doc<'pluginReleases'> | Doc<'projectVersions'>
	},
) {
	if (args.scope !== 'release') {
		const claim = await ctx.db
			.query('reviewClaims')
			.withIndex('by_contentId', (q) =>
				q.eq('contentId', args.content._id),
			)
			.unique()
		if (claim) await ctx.db.delete(claim._id)
	}
	const gallery = await galleryFor(ctx, args.content)
	const approved = Boolean(
		args.content.publishedAt || args.content.status === 'published',
	)
	const baseline = await baselineRelease(ctx, args.content)
	const before = approved
		? await fieldsFor(
				ctx,
				args.content,
				args.content,
				publicGallery(args.content, gallery),
				baseline ?? undefined,
			)
		: undefined
	const after = await fieldsFor(
		ctx,
		args.content,
		args.details,
		args.scope === 'release'
			? publicGallery(args.content, gallery)
			: gallery,
		args.release ?? baseline ?? undefined,
	)
	const id = await ctx.db.insert('moderationEvents', {
		contentId: args.content._id,
		contentType: contentKind(args.content),
		kind: 'submission',
		scope: args.scope ?? 'listing',
		action: 'submitted',
		actorId: args.actorId,
		revision: args.revision,
		releaseId: args.release?._id,
		label: args.release
			? `Version ${args.release.version}`
			: args.content.name,
		before,
		after,
		createdAt: Date.now(),
	})
	for (const key of mediaKeys([...(before ?? []), ...after]))
		await ctx.db.insert('moderationMediaReferences', { eventId: id, key })
	return id
}
export async function recordDecisionHistory(
	ctx: MutationCtx,
	audit: Doc<'adminActions'>,
) {
	let contentId: string | undefined
	let contentType: 'server' | 'project' | 'plugin' | undefined
	let releaseId: string | undefined
	if (['server', 'project', 'plugin'].includes(audit.targetType)) {
		contentId = audit.targetId
		contentType = audit.targetType as typeof contentType
	}
	if (audit.targetType === 'pluginRelease') {
		const id = ctx.db.normalizeId('pluginReleases', audit.targetId)
		const row = id ? await ctx.db.get('pluginReleases', id) : null
		if (row) {
			contentId = row.projectId
			contentType = 'plugin'
			releaseId = row._id
		}
	}
	if (audit.targetType === 'projectVersion') {
		const id = ctx.db.normalizeId('projectVersions', audit.targetId)
		const row = id ? await ctx.db.get('projectVersions', id) : null
		if (row) {
			contentId = row.projectId
			contentType = 'project'
			releaseId = row._id
		}
	}
	if (!contentId || !contentType) return false
	if (
		await ctx.db
			.query('moderationEvents')
			.withIndex('by_sourceAuditId', (q) =>
				q.eq('sourceAuditId', audit._id),
			)
			.first()
	)
		return false
	await ctx.db.insert('moderationEvents', {
		contentId,
		contentType,
		kind: 'decision',
		scope: releaseId ? 'release' : 'listing',
		action: audit.action,
		sourceAuditId: audit._id,
		releaseId,
		label: audit.targetLabel,
		createdAt: audit.createdAt,
	})
	return true
}
export async function isReviewMediaRetained(ctx: MutationCtx, key: string) {
	return Boolean(
		await ctx.db
			.query('moderationMediaReferences')
			.withIndex('by_key', (q) => q.eq('key', key))
			.first(),
	)
}
export async function deleteUnretainedMedia(ctx: MutationCtx, key: string) {
	if (await isReviewMediaRetained(ctx, key)) return
	await r2.deleteObject(ctx, key)
}
export async function displayValue(field: SnapshotField) {
	if (field.kind === 'image' && field.value.startsWith('key:'))
		return resolveCdnObjectUrl(field.value.slice(4), 3600)
	if (field.kind === 'image' && field.value.startsWith('url:'))
		return field.value.slice(4)
	if (field.kind === 'gallery' && field.value)
		return JSON.stringify(
			await Promise.all(
				(
					JSON.parse(field.value) as {
						key: string
						caption: string
						fileName: string
					}[]
				).map(async (row) => ({
					caption: row.caption,
					fileName: row.fileName,
					url: await resolveCdnObjectUrl(row.key, 3600),
				})),
			),
		)
	return field.value
}
export async function comparison(
	before: SnapshotField[] | undefined,
	after: SnapshotField[],
) {
	const old = new Map((before ?? []).map((field) => [field.key, field]))
	const changed = after.filter(
		(field) => field.value !== (old.get(field.key)?.value ?? ''),
	)
	return {
		firstSubmission: before === undefined,
		fields: await Promise.all(
			changed.map(async (field) => ({
				key: field.key,
				label: field.label,
				kind: field.kind,
				before: old.get(field.key)?.value
					? await displayValue(old.get(field.key)!)
					: null,
				after: field.value ? await displayValue(field) : null,
			})),
		),
	}
}
