import { describe, expect, test } from 'bun:test'
import {
	isPublicProject,
	isPublicServer,
	requiresModerationReason,
} from './contentVisibility'
import {
	canManageContentOwner,
	canModifyProjectOwner,
	canModifyServerOwner,
	isOrganizationManagerRole,
} from './contentOwnership'
import {
	getPublishedReleaseKey,
	isApprovedRelease,
	isPublicRelease,
	isValidatedRelease,
} from './projectReleases'

describe('public content visibility', () => {
	test('projects require publication and moderation approval', () => {
		expect(
			isPublicProject({ status: 'published', moderationStatus: 'approved' }),
		).toBeTrue()
		expect(
			isPublicProject({ status: 'published', moderationStatus: 'pending' }),
		).toBeFalse()
		expect(
			isPublicProject({ status: 'under_review', moderationStatus: 'approved' }),
		).toBeFalse()
	})

	test('verified servers are public immediately after owner publication', () => {
		expect(isPublicServer({ status: 'published' })).toBeTrue()
		expect(isPublicServer({ status: 'draft' })).toBeFalse()
		expect(isPublicServer({ status: 'under_review' })).toBeFalse()
	})
})

describe('moderation policy', () => {
	test('flagging and rejection require a moderator reason', () => {
		expect(requiresModerationReason('flagged')).toBeTrue()
		expect(requiresModerationReason('rejected')).toBeTrue()
		expect(requiresModerationReason('approved')).toBeFalse()
		expect(requiresModerationReason('pending')).toBeFalse()
	})
})

describe('content ownership policy', () => {
	test('projects allow their user owner or an organization member', () => {
		expect(
			canModifyProjectOwner({
				owner: { ownerType: 'user', ownerId: 'user_1' },
				userId: 'user_1',
			}),
		).toBeTrue()
		expect(
			canModifyProjectOwner({
				owner: { ownerType: 'user', ownerId: 'user_1' },
				userId: 'user_2',
			}),
		).toBeFalse()
		expect(
			canModifyProjectOwner({
				owner: { ownerType: 'organization', ownerId: 'org_1' },
				userId: 'user_2',
				isOrganizationMember: true,
			}),
		).toBeTrue()
	})

	test('servers also allow admins and the original registrant', () => {
		const owner = {
			ownerType: 'user' as const,
			ownerId: 'user_1',
			registeredBy: 'user_2',
		}
		expect(canModifyServerOwner({ owner, userId: 'user_2' })).toBeTrue()
		expect(
			canModifyServerOwner({ owner, userId: 'admin_1', role: 'admin' }),
		).toBeTrue()
		expect(canModifyServerOwner({ owner, userId: 'user_3' })).toBeFalse()
	})
})

describe('project release availability', () => {
	test('accepts valid and pre-validation legacy releases', () => {
		expect(isValidatedRelease({ validationStatus: 'valid' })).toBeTrue()
		expect(isValidatedRelease({})).toBeTrue()
		expect(isValidatedRelease({ validationStatus: 'pending' })).toBeFalse()
		expect(isValidatedRelease({ validationStatus: 'invalid' })).toBeFalse()
	})

	test('releases need moderator approval before they are public', () => {
		expect(isApprovedRelease({})).toBeTrue()
		expect(isApprovedRelease({ reviewStatus: 'approved' })).toBeTrue()
		expect(isApprovedRelease({ reviewStatus: 'pending' })).toBeFalse()
		expect(isApprovedRelease({ reviewStatus: 'rejected' })).toBeFalse()
		expect(
			isPublicRelease({ validationStatus: 'valid', reviewStatus: 'pending' }),
		).toBeFalse()
		expect(
			isPublicRelease({ validationStatus: 'pending', reviewStatus: 'approved' }),
		).toBeFalse()
		expect(
			isPublicRelease({ validationStatus: 'valid', reviewStatus: 'approved' }),
		).toBeTrue()
	})

	test('exposes only promoted CDN artifacts', () => {
		const uploadKey =
			'uploads/projects/project_1/releases/release_1/upload_1.mcaddon'
		const downloadKey =
			'downloads/projects/project_1/releases/release_1/artifact_1.mcaddon'

		expect(
			getPublishedReleaseKey({
				r2Key: uploadKey,
				uploadR2Key: uploadKey,
			}),
		).toBeUndefined()
		expect(
			getPublishedReleaseKey({
				r2Key: uploadKey,
				uploadR2Key: uploadKey,
				cdnR2Key: downloadKey,
			}),
		).toBe(downloadKey)
		expect(getPublishedReleaseKey({ r2Key: downloadKey })).toBe(downloadKey)
	})
})

describe('organization roles', () => {
	test('recognizes owner and admin among comma-separated roles', () => {
		expect(isOrganizationManagerRole('owner')).toBeTrue()
		expect(isOrganizationManagerRole('member, admin')).toBeTrue()
		expect(isOrganizationManagerRole('member')).toBeFalse()
		expect(isOrganizationManagerRole(null)).toBeFalse()
	})

	test('only owners, organization managers, and site admins manage content', () => {
		const orgContent = { ownerType: 'organization' as const, ownerId: 'org' }
		expect(
			canManageContentOwner({ owner: orgContent, userId: 'u', organizationRole: 'member' }),
		).toBeFalse()
		expect(
			canManageContentOwner({ owner: orgContent, userId: 'u', organizationRole: 'admin' }),
		).toBeTrue()
		expect(
			canManageContentOwner({ owner: orgContent, userId: 'u', role: 'admin' }),
		).toBeTrue()
		expect(
			canManageContentOwner({
				owner: { ownerType: 'user', ownerId: 'u' },
				userId: 'u',
			}),
		).toBeTrue()
	})
})
