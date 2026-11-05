import { ConvexError } from 'convex/values'
import type { Doc } from '../_generated/dataModel'

export type Submission = {
	submissionStatus?: 'pending' | 'changes_requested' | 'approved' | 'rejected'
	submissionRevision?: number
	draftChangesJson?: string
}
const PROJECT_FIELDS = [
	'type',
	'name',
	'slug',
	'summary',
	'description',
	'iconR2Key',
	'bannerR2Key',
	'categoryIds',
	'tags',
	'metadata',
	'sourceUrl',
	'websiteUrl',
	'issueTrackerUrl',
	'wikiUrl',
	'discordUrl',
	'donationUrl',
	'license',
	'licenseCustom',
] as const
const SERVER_FIELDS = [
	'name',
	'slug',
	'smallDescription',
	'description',
	'ipAddress',
	'port',
	'addressKey',
	'logoR2Key',
	'bannerR2Key',
	'categoryIds',
	'tags',
	'softwareId',
	'website',
	'discordUrl',
	'storeUrl',
	'wikiUrl',
	'region',
	'language',
	'gameVersions',
	'verifiedAt',
	'verifiedBy',
	'verificationMethod',
] as const
export const PLUGIN_FIELDS = [
	'slug',
	'name',
	'summary',
	'description',
	'license',
	'licenseCustom',
	'iconUrl',
	'categoryIds',
	'websiteUrl',
	'wikiUrl',
	'discordUrl',
	'issuesUrl',
	'donationUrl',
] as const

function fields(item: object) {
	return 'smallDescription' in item
		? SERVER_FIELDS
		: 'type' in item
			? PROJECT_FIELDS
			: PLUGIN_FIELDS
}
export function snapshot(item: object, changes: object = {}): string {
	const merged = { ...item, ...changes } as Record<string, unknown>
	return JSON.stringify(
		Object.fromEntries(
			fields(item).map((key) => [key, merged[key] ?? null]),
		),
	)
}
export function snapshotPatch<T extends object>(
	item: T,
	json: string,
): Partial<T> {
	const saved = JSON.parse(json) as Record<string, unknown>
	return Object.fromEntries(
		fields(item)
			.filter((key) => key in saved)
			.map((key) => [key, saved[key] === null ? undefined : saved[key]]),
	) as Partial<T>
}
export function submissionView<T extends Submission>(item: T): T {
	return item.draftChangesJson
		? { ...item, ...snapshotPatch(item, item.draftChangesJson) }
		: item
}
export function assertSubmissionEditable(
	item: Submission & { status: string; moderationStatus?: string },
) {
	if (
		item.submissionStatus === 'pending' ||
		(!item.submissionStatus &&
			(item.status === 'under_review' || item.status === 'review') &&
			item.moderationStatus === 'pending')
	) {
		throw new ConvexError(
			'This submission is awaiting review. Its details are locked until a moderator decides.',
		)
	}
}
export function assertReviewRevision(
	item: Submission,
	expectedRevision?: number,
) {
	if (
		(item.submissionRevision !== undefined ||
			expectedRevision !== undefined) &&
		expectedRevision !== (item.submissionRevision ?? 0)
	) {
		throw new ConvexError(
			'This submission changed since you opened it. Reload and review the current revision before deciding.',
		)
	}
}
export function moderationReason(reason?: string) {
	const value = reason?.trim()
	if (!value || value.length > 500)
		throw new ConvexError(
			'Add a reason for the creator in 1 to 500 characters.',
		)
	return value
}
export function decisionFields(
	item: Submission,
	status: NonNullable<Submission['submissionStatus']>,
	reason?: string,
) {
	return {
		submissionStatus: status,
		submissionReason: reason,
		submissionRevision: (item.submissionRevision ?? 0) + 1,
	}
}
export function hasApprovedListing(item: Doc<'projects'> | Doc<'servers'>) {
	return item.status === 'published' && item.moderationStatus === 'approved'
}
