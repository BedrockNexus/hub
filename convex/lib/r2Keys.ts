type BuildUserR2ObjectKeyArgs = {
	userId: string
	resourceType: 'editor' | 'organizations' | 'profiles' | 'projects' | 'servers'
	segments: string[]
	fileName: string
}

type BuildEntityImageR2ObjectKeyArgs = {
	userId: string
	resourceType: 'projects' | 'servers'
	entityId: string
	imageKind: 'banner' | 'gallery' | 'icon' | 'logo'
	fileName: string
}

type BuildProjectVersionR2ObjectKeyArgs = {
	userId: string
	projectId: string
	version: string
	fileName: string
}

export type EditorMediaKind = 'audio' | 'file' | 'image' | 'video'
export type SiteImageKind = 'favicon' | 'logo' | 'open-graph'

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

export function buildUserR2ObjectKey({
	userId,
	resourceType,
	segments,
	fileName,
}: BuildUserR2ObjectKeyArgs): string {
	const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeR2FileName(fileName)}`

	return [userId, resourceType, ...segments, uniqueFileName]
		.map(sanitizeR2PathSegment)
		.join('/')
}

export function buildEntityImageR2ObjectKey({
	userId,
	resourceType,
	entityId,
	imageKind,
	fileName,
}: BuildEntityImageR2ObjectKeyArgs): string {
	const folder =
		resourceType === 'projects' && imageKind === 'icon'
			? 'logo'
			: imageKind
	const extension = getSafeFileExtension(fileName)

	return [
		userId,
		resourceType,
		entityId,
		folder,
		`${crypto.randomUUID()}.${extension}`,
	]
		.map(sanitizeR2PathSegment)
		.join('/')
}

export function buildProjectVersionR2ObjectKey({
	userId,
	projectId,
	version,
	fileName,
}: BuildProjectVersionR2ObjectKeyArgs): string {
	return [
		userId,
		'projects',
		projectId,
		'versions',
		version,
		sanitizeR2FileName(fileName),
	]
		.map(sanitizeR2PathSegment)
		.join('/')
}

export function buildSiteImageR2ObjectKey(args: {
	userId: string
	imageKind: SiteImageKind
	fileName: string
}): string {
	const extension = getSafeFileExtension(args.fileName)

	return [
		args.userId,
		'site',
		args.imageKind,
		`${crypto.randomUUID()}.${extension}`,
	]
		.map(sanitizeR2PathSegment)
		.join('/')
}

export function isEditorMediaR2Key(key: string): boolean {
	return /^[^/]+\/editor\/media\/(audio|file|image|video)\/.+/.test(key)
}

export function isManagedEntityR2Key(key: string): boolean {
	return /^[^/]+\/(organizations|profiles|projects|servers)\/[^/]+\/(banner|gallery|logo|versions)\/.+/.test(
		key,
	)
}

export function isSiteImageR2Key(
	key: string,
	imageKind?: SiteImageKind,
): boolean {
	const match = key.match(
		/^[^/]+\/site\/(favicon|logo|open-graph)\/[^/]+$/,
	)

	return Boolean(match && (!imageKind || match[1] === imageKind))
}

export function isManagedR2Key(key: string): boolean {
	return isManagedEntityR2Key(key) || isSiteImageR2Key(key)
}
