import { describe, expect, it } from 'vitest'
import {
	adminReviewTarget,
	moderationReviewHref,
	reviewedReleaseId,
	reviewTabFor,
} from '../lib/admin-review-navigation'

describe('moderation review navigation', () => {
	it.each([
		['addons', 'projects'],
		['resource-packs', 'projects'],
		['plugins', 'plugins'],
		['servers', 'servers'],
	])('recognizes a %s review page', (collection, kind) => {
		expect(adminReviewTarget(`/moderation/${collection}/example`)).toEqual({
			kind,
			id: 'example',
		})
	})
	it.each([
		'/moderation',
		'/moderation/addons',
		'/moderation/resource-packs',
		'/moderation/plugins',
		'/moderation/servers',
		'/admin',
		'/admin/projects/example',
		'/admin/plugins/workflows',
		'/admin/plugins/workflows/pocketmine',
		'/admin/plugins/deliveries',
		'/admin/settings',
	])('keeps the main sidebar on %s', (path) => {
		expect(adminReviewTarget(path)).toBeNull()
	})
	it('links each content type to its moderation section', () => {
		expect(
			moderationReviewHref('projects', 'a', { projectType: 'addon' }),
		).toBe('/moderation/addons/a')
		expect(
			moderationReviewHref('projects', 'b', {
				projectType: 'resource_pack',
			}),
		).toBe('/moderation/resource-packs/b')
		expect(
			moderationReviewHref('projects', 'c', {
				projectType: 'texture_pack',
				releaseId: 'v1',
			}),
		).toBe('/moderation/resource-packs/c#release-v1')
		expect(moderationReviewHref('plugins', 'd')).toBe(
			'/moderation/plugins/d',
		)
		expect(moderationReviewHref('servers', 'e')).toBe(
			'/moderation/servers/e',
		)
	})
	it('opens direct version links while allowing navigation away without losing the selected version', () => {
		const hash = '#release-version-id'
		expect(reviewTabFor(null, hash)).toBe('files')
		expect(reviewedReleaseId(null, hash)).toBe('version-id')
		expect(reviewTabFor('listing', hash)).toBe('listing')
		expect(reviewTabFor('history', hash)).toBe('history')
		expect(reviewedReleaseId('selected-version', hash)).toBe(
			'selected-version',
		)
		expect(reviewedReleaseId('listing', hash)).toBeNull()
	})
	it("leaves the tab to the page's default without a release link", () => {
		expect(reviewTabFor(null, '')).toBeNull()
		expect(reviewedReleaseId(null, '#unrelated')).toBeNull()
	})
})
