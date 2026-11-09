import type { Doc } from '../_generated/dataModel'

/**
 * What the public may see of each document. Public queries can be called by
 * anyone, not only by this site's pages, so they return these views instead of
 * spreading a document: a field added to a table stays private until it is
 * listed here. Owner and admin queries keep returning the whole document.
 */

export function toPublicServer(server: Doc<'servers'>) {
	return {
		_id: server._id,
		_creationTime: server._creationTime,
		status: server.status,
		name: server.name,
		slug: server.slug,
		smallDescription: server.smallDescription,
		description: server.description,
		ipAddress: server.ipAddress,
		port: server.port,
		categoryIds: server.categoryIds,
		tags: server.tags,
		softwareId: server.softwareId,
		website: server.website,
		discordUrl: server.discordUrl,
		storeUrl: server.storeUrl,
		wikiUrl: server.wikiUrl,
		ownerType: server.ownerType,
		publishedAt: server.publishedAt,
		region: server.region,
		language: server.language,
		gameVersions: server.gameVersions,
		verifiedAt: server.verifiedAt,
		offlineHiddenAt: server.offlineHiddenAt,
		updatedAt: server.updatedAt,
	}
}

export type PublicProject = ReturnType<typeof toPublicProject>

export function toPublicProject(project: Doc<'projects'>) {
	return {
		_id: project._id,
		_creationTime: project._creationTime,
		status: project.status,
		type: project.type,
		publicId: project.publicId,
		name: project.name,
		slug: project.slug,
		summary: project.summary,
		description: project.description,
		categoryIds: project.categoryIds,
		tags: project.tags,
		metadata: project.metadata,
		sourceUrl: project.sourceUrl,
		websiteUrl: project.websiteUrl,
		issueTrackerUrl: project.issueTrackerUrl,
		wikiUrl: project.wikiUrl,
		discordUrl: project.discordUrl,
		donationUrl: project.donationUrl,
		ownerType: project.ownerType,
		publishedAt: project.publishedAt,
		license: project.license,
		licenseCustom: project.licenseCustom,
		credits: project.credits,
		latestVersionString: project.latestVersionString,
		latestVersionAt: project.latestVersionAt,
		versionCount: project.versionCount,
		supportedGameVersions: project.supportedGameVersions,
		updatedAt: project.updatedAt,
	}
}

interface ReviewFields {
	_id: string
	authorReply?: { content: string; createdAt: number }
	content?: string
	createdAt: number
	helpfulCount?: number
	isEdited?: boolean
	rating: number
	updatedAt?: number
}

/** Leaves out the reviewer's account ID; their public profile comes separately. */
export function toPublicReview<Review extends ReviewFields>(review: Review) {
	return {
		_id: review._id as Review['_id'],
		rating: review.rating,
		content: review.content,
		helpfulCount: review.helpfulCount,
		isEdited: review.isEdited,
		authorReply: review.authorReply,
		createdAt: review.createdAt,
		updatedAt: review.updatedAt,
	}
}

interface GalleryFields {
	_id: string
	caption?: string
	fileName: string
	mimeType: string
	sortOrder: number
}

/** Leaves out the owner's account ID and the storage key behind `url`. */
export function toPublicGalleryItem<Item extends GalleryFields>(
	item: Item,
	url: string,
) {
	return {
		_id: item._id as Item['_id'],
		caption: item.caption,
		fileName: item.fileName,
		mimeType: item.mimeType,
		sortOrder: item.sortOrder,
		url,
	}
}
