type BuildEntityImageR2ObjectKeyArgs = {
	resourceType: 'projects' | 'servers'
	entityId: string
	imageKind: 'banner' | 'gallery' | 'icon' | 'logo'
	fileName: string
}

type BuildProjectVersionR2ObjectKeyArgs = {
	projectId: string
	releaseId: string
	artifactId: string
	fileName: string
}

export type EditorMediaKind = 'audio' | 'file' | 'image' | 'video'
export type SiteImageKind = 'favicon' | 'logo' | 'open-graph'
export type MediaEntityType =
	| 'organizations'
	| 'profiles'
	| 'projects'
	| 'servers'
	| 'site'

function sanitizeR2PathSegment(segment: string): string {
	const safeSegment = segment.replace(/[^a-zA-Z0-9._-]/g, '_')
	return safeSegment || 'unknown'
}

export function sanitizeR2FileName(fileName: string): string {
	const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
	return safeName || 'upload'
}

function getSafeFileExtension(fileName: string): string {
	const sanitized = sanitizeR2FileName(fileName)
	const extension = sanitized.split('.').pop()

	if (!extension || extension === sanitized) {
		return 'bin'
	}

	return sanitizeR2PathSegment(extension.toLowerCase())
}

export function buildMediaR2ObjectKey(args: {
	entityType: MediaEntityType
	entityId: string
	mediaKind: string
	fileName: string
	assetId?: string
}): string {
	const extension = getSafeFileExtension(args.fileName)
	return [
		'media',
		args.entityType,
		args.entityId,
		args.mediaKind,
		`${args.assetId ?? crypto.randomUUID()}.${extension}`,
	]
		.map(sanitizeR2PathSegment)
		.join('/')
}

export function buildEntityImageR2ObjectKey({
	resourceType,
	entityId,
	imageKind,
	fileName,
}: BuildEntityImageR2ObjectKeyArgs): string {
	return buildMediaR2ObjectKey({
		entityType: resourceType,
		entityId,
		mediaKind: imageKind,
		fileName,
	})
}

export function buildProfileMediaR2ObjectKey(args: {
	userId: string
	mediaKind: 'banner' | `editor-${EditorMediaKind}`
	fileName: string
}): string {
	return buildMediaR2ObjectKey({
		entityType: 'profiles',
		entityId: args.userId,
		mediaKind: args.mediaKind,
		fileName: args.fileName,
	})
}

export function buildOrganizationMediaR2ObjectKey(args: {
	organizationId: string
	mediaKind: 'banner'
	fileName: string
}): string {
	return buildMediaR2ObjectKey({
		entityType: 'organizations',
		entityId: args.organizationId,
		mediaKind: args.mediaKind,
		fileName: args.fileName,
	})
}

export function buildProjectVersionR2ObjectKey({
	projectId,
	releaseId,
	artifactId,
	fileName,
}: BuildProjectVersionR2ObjectKeyArgs): string {
	const extension = getSafeFileExtension(fileName)
	return [
		'artifacts',
		'projects',
		projectId,
		'releases',
		releaseId,
		`${sanitizeR2PathSegment(artifactId)}.${extension}`,
	]
		.map(sanitizeR2PathSegment)
		.join('/')
}

export function buildSiteImageR2ObjectKey(args: {
	imageKind: SiteImageKind
	fileName: string
}): string {
	return buildMediaR2ObjectKey({
		entityType: 'site',
		entityId: 'global',
		mediaKind: args.imageKind,
		fileName: args.fileName,
	})
}

export function buildTemporaryR2ObjectKey(args: {
	userId: string
	uploadId: string
	assetId?: string
	fileName: string
}): string {
	const extension = getSafeFileExtension(args.fileName)
	return [
		'temporary',
		args.userId,
		args.uploadId,
		`${args.assetId ?? crypto.randomUUID()}.${extension}`,
	]
		.map(sanitizeR2PathSegment)
		.join('/')
}

export function isEditorMediaR2Key(key: string, userId?: string): boolean {
	const mediaMatch = key.match(
		/^media\/profiles\/([^/]+)\/editor-(audio|file|image|video)\/[^/]+$/,
	)
	const legacyMatch = key.match(
		/^([^/]+)\/editor\/media\/(audio|file|image|video)\/.+/,
	)
	return Boolean(
		(mediaMatch &&
			(!userId || mediaMatch[1] === sanitizeR2PathSegment(userId))) ||
			(legacyMatch &&
				(!userId || legacyMatch[1] === sanitizeR2PathSegment(userId))),
	)
}

export function isEntityImageR2Key(args: {
	key: string
	resourceType: 'projects' | 'servers'
	entityId: string
	imageKind: 'banner' | 'gallery' | 'icon' | 'logo'
}): boolean {
	const prefix = ['media', args.resourceType, args.entityId, args.imageKind]
		.map(sanitizeR2PathSegment)
		.join('/')
	return args.key.startsWith(`${prefix}/`) && args.key.split('/').length === 5
}

export function isProfileMediaR2Key(
	key: string,
	userId: string,
	mediaKind: 'banner' | `editor-${EditorMediaKind}`,
): boolean {
	const prefix = ['media', 'profiles', userId, mediaKind]
		.map(sanitizeR2PathSegment)
		.join('/')
	return key.startsWith(`${prefix}/`) && key.split('/').length === 5
}

export function isOrganizationMediaR2Key(
	key: string,
	organizationId: string,
	mediaKind: 'banner',
): boolean {
	const prefix = ['media', 'organizations', organizationId, mediaKind]
		.map(sanitizeR2PathSegment)
		.join('/')
	return key.startsWith(`${prefix}/`) && key.split('/').length === 5
}

export function isManagedEntityR2Key(key: string): boolean {
	return (
		/^media\/(organizations|profiles|projects|servers|site)\/[^/]+\/[^/]+\/[^/]+$/.test(
			key,
		) ||
		/^[^/]+\/(organizations|profiles|projects|servers)\/[^/]+\/(banner|gallery|logo|versions)\/.+/.test(
			key,
		)
	)
}

export function isSiteImageR2Key(
	key: string,
	imageKind?: SiteImageKind,
): boolean {
	const match = key.match(
		/^media\/site\/global\/(favicon|logo|open-graph)\/[^/]+$/,
	)
	const legacyMatch = key.match(
		/^[^/]+\/site\/(favicon|logo|open-graph)\/[^/]+$/,
	)

	return Boolean(
		(match && (!imageKind || match[1] === imageKind)) ||
			(legacyMatch && (!imageKind || legacyMatch[1] === imageKind)),
	)
}

export function isTemporaryR2Key(key: string, userId?: string): boolean {
	const match = key.match(/^temporary\/([^/]+)\/[^/]+\/[^/]+$/)
	return Boolean(
		match &&
			(!userId || match[1] === sanitizeR2PathSegment(userId)),
	)
}

export function isManagedR2Key(key: string): boolean {
	return (
		isManagedEntityR2Key(key) ||
		isSiteImageR2Key(key) ||
		isTemporaryR2Key(key) ||
		/^artifacts\/projects\/[^/]+\/releases\/[^/]+\/[^/]+$/.test(key)
	)
}
