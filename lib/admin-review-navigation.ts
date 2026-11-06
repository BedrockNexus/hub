export const REVIEW_SECTIONS = [
	{ id: 'overview', title: 'Overview' },
	{ id: 'changes', title: 'Submitted changes' },
	{ id: 'description', title: 'Description' },
	{ id: 'gallery', title: 'Gallery' },
	{ id: 'versions', title: 'Versions & files' },
	{ id: 'links', title: 'Links & licence' },
	{ id: 'history', title: 'Moderation history' },
] as const
export type ReviewSection = (typeof REVIEW_SECTIONS)[number]['id']
export const REVIEW_SECTION_IDS = REVIEW_SECTIONS.map((section) => section.id)
const REVIEW_PATH =
	/^\/moderation\/(addons|resource-packs|plugins|servers)\/([^/]+)\/?$/
type ReviewKind = 'projects' | 'plugins' | 'servers'
const KIND_BY_COLLECTION: Record<string, ReviewKind> = {
	addons: 'projects',
	'resource-packs': 'projects',
	plugins: 'plugins',
	servers: 'servers',
}
/** The submission a moderation URL reviews, or null for any other page. */
export function adminReviewTarget(pathname: string) {
	const match = pathname.match(REVIEW_PATH)
	if (!match) {
		return null
	}
	return { kind: KIND_BY_COLLECTION[match[1]], id: match[2] }
}
/** The moderation list for a content type, such as `/moderation/addons`. */
export function moderationCollectionHref(
	kind: ReviewKind,
	projectType?: string,
) {
	if (kind !== 'projects') {
		return `/moderation/${kind}`
	}
	return projectType === 'resource_pack' || projectType === 'texture_pack'
		? '/moderation/resource-packs'
		: '/moderation/addons'
}
/** The review screen for one submission, optionally opened at a version. */
export function moderationReviewHref(
	kind: ReviewKind,
	id: string,
	{
		projectType,
		releaseId,
	}: { projectType?: string; releaseId?: string } = {},
) {
	const release = releaseId ? `#release-${releaseId}` : ''
	return `${moderationCollectionHref(kind, projectType)}/${id}${release}`
}
export function reviewSectionFor(
	section: ReviewSection | null,
	hash: string,
): ReviewSection {
	return section ?? (hash.startsWith('#release-') ? 'versions' : 'overview')
}
export function reviewedReleaseId(selected: string | null, hash: string) {
	if (selected === 'listing') {
		return null
	}
	return (
		selected ??
		(hash.startsWith('#release-') ? hash.slice('#release-'.length) : null)
	)
}
