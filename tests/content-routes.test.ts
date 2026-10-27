import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchQuery, fetchAuthQuery, getSiteSeo } = vi.hoisted(() => ({
	fetchQuery: vi.fn(),
	fetchAuthQuery: vi.fn(),
	getSiteSeo: vi.fn(),
}))

vi.mock('convex/nextjs', () => ({ fetchQuery }))
vi.mock('@/lib/auth-server', () => ({ fetchAuthQuery }))
vi.mock('@/lib/site-settings', () => ({ getSiteSeo }))
vi.mock('@/components/projects/detail/project-detail-shell', () => ({
	ProjectDetailShell: () => null,
}))
vi.mock('@/components/user-dashboard/projects/submission-review', () => ({
	ProjectSubmissionReview: () => null,
}))
vi.mock(
	'@/components/user-dashboard/projects/edit/general-settings-form',
	() => ({ ProjectGeneralSettingsForm: () => null }),
)
vi.mock(
	'@/components/user-dashboard/projects/edit/description-settings-form',
	() => ({ ProjectDescriptionSettingsForm: () => null }),
)
vi.mock(
	'@/components/user-dashboard/projects/edit/categories-settings-form',
	() => ({ ProjectCategoriesSettingsForm: () => null }),
)
vi.mock(
	'@/components/user-dashboard/projects/edit/links-settings-form',
	() => ({ ProjectLinksSettingsForm: () => null }),
)
vi.mock(
	'@/components/user-dashboard/projects/edit/license-settings-form',
	() => ({ ProjectLicenseSettingsForm: () => null }),
)
vi.mock(
	'@/components/user-dashboard/projects/edit/gallery-settings-form',
	() => ({ ProjectGallerySettingsForm: () => null }),
)
vi.mock(
	'@/components/user-dashboard/projects/edit/versions-settings-form',
	() => ({ ProjectVersionsForm: () => null }),
)
vi.mock(
	'@/components/user-dashboard/projects/versions/add-version-form',
	() => ({ AddVersionForm: () => null }),
)

import LegacyPublicPage from '../app/(public)/projects/[slug]/[[...section]]/page'
import LegacySettingsPage from '../app/dashboard/projects/[id]/[[...section]]/page'
import {
	ContentPage,
	contentMetadata,
} from '../components/projects/detail/content-page'
import { ContentSettingsPage } from '../components/user-dashboard/projects/content-settings-page'

const project = {
	_id: 'existing-id',
	slug: 'example',
	type: 'addon',
	name: 'Example',
	summary: 'Example addon',
	reviewCount: 0,
}

beforeEach(() => {
	vi.resetAllMocks()
	fetchQuery.mockResolvedValue(project)
	fetchAuthQuery.mockResolvedValue(project)
	getSiteSeo.mockResolvedValue({})
})

describe('typed public content routes', () => {
	it('uses type-specific canonical URLs for listings and release pages', async () => {
		const meta = await contentMetadata(
			{
				params: Promise.resolve({
					slug: 'example',
					section: ['gallery'],
				}),
			},
			'addon',
		)
		expect(meta.alternates?.canonical).toBe(
			'https://bedrocknexus.com/addons/example/gallery',
		)
		fetchQuery
			.mockResolvedValueOnce({ ...project, type: 'texture_pack' })
			.mockResolvedValueOnce({ version: '1.0+test' })
		const releaseMeta = await contentMetadata(
			{
				params: Promise.resolve({
					slug: 'example',
					section: ['releases', '1.0+test'],
				}),
			},
			'resource_pack',
		)
		expect(releaseMeta.alternates?.canonical).toBe(
			'https://bedrocknexus.com/resource-packs/example/releases/1.0%2Btest',
		)
	})

	it('rejects missing content and a listing served under the wrong type', async () => {
		await expect(
			ContentPage({
				params: Promise.resolve({ slug: 'example' }),
				type: 'resource_pack',
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
		fetchQuery.mockResolvedValue(null)
		await expect(
			ContentPage({
				params: Promise.resolve({ slug: 'missing' }),
				type: 'addon',
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
	})

	it('rejects unknown tabs and unpublished or nonexistent release versions', async () => {
		await expect(
			ContentPage({
				params: Promise.resolve({
					slug: 'example',
					section: ['invalid'],
				}),
				type: 'addon',
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
		fetchQuery.mockResolvedValueOnce(project).mockResolvedValueOnce(null)
		await expect(
			ContentPage({
				params: Promise.resolve({
					slug: 'example',
					section: ['releases', 'missing'],
				}),
				type: 'addon',
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
	})

	it('redirects old detail and version links to the correct type while preserving query strings', async () => {
		fetchQuery.mockResolvedValue({ ...project, type: 'resource_pack' })
		await expect(
			LegacyPublicPage({
				params: Promise.resolve({
					slug: 'example',
					section: ['versions'],
				}),
				searchParams: Promise.resolve({ source: 'creator' }),
			}),
		).rejects.toMatchObject({
			digest: expect.stringContaining(
				'/resource-packs/example/releases?source=creator',
			),
		})
	})
})

describe('typed creator routes', () => {
	it('keeps existing IDs when resolving historical slug/edit links', async () => {
		fetchAuthQuery.mockResolvedValue({ ...project, type: 'resource_pack' })
		await expect(
			LegacySettingsPage({
				params: Promise.resolve({
					id: 'example',
					section: ['edit', 'gallery'],
				}),
				searchParams: Promise.resolve({}),
			}),
		).rejects.toMatchObject({
			digest: expect.stringContaining(
				'/dashboard/resource-packs/existing-id/gallery',
			),
		})
	})

	it('requires the existing ownership check before rendering or redirecting', async () => {
		fetchAuthQuery.mockResolvedValue(null)
		await expect(
			ContentSettingsPage({
				params: Promise.resolve({ id: 'private' }),
				type: 'addon',
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
		await expect(
			LegacySettingsPage({
				params: Promise.resolve({ id: 'private' }),
				searchParams: Promise.resolve({}),
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
	})

	it('does not render an addon editor under resource packs', async () => {
		await expect(
			ContentSettingsPage({
				params: Promise.resolve({ id: project._id }),
				type: 'resource_pack',
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
	})
})
