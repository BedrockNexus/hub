import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { ensureProjectStats, syncProject } from '../../lib/discovery'
import { createTest, type TestClient } from '../../test.setup'

type ProjectFields = Partial<Doc<'projects'>> & { slug: string }
type StatsFields = Partial<
	Pick<
		Doc<'projectStats'>,
		| 'totalDownloads'
		| 'averageRating'
		| 'reviewCount'
		| 'favouriteCount'
		| 'trendingScore'
	>
>

/** A project with its listing fields in place, as the write hooks leave it. */
async function addProject(
	t: TestClient,
	fields: ProjectFields,
	stats: StatsFields = {},
) {
	return await t.run(async (ctx) => {
		const id = await ctx.db.insert('projects', {
			type: 'addon',
			name: fields.slug,
			summary: 'A test project',
			description: 'A test project',
			categoryIds: [],
			ownerType: 'user',
			ownerId: 'owner',
			createdBy: 'owner',
			status: 'published',
			moderationStatus: 'approved',
			updatedAt: 1,
			...fields,
		})
		const project = await ctx.db.get(id)
		if (!project) throw new Error('Project was not created')
		await syncProject(ctx, project)
		const row = await ensureProjectStats(ctx, id)
		await ctx.db.patch(row._id, stats)
		return id
	})
}

async function addCategory(t: TestClient, name: string) {
	return await t.run(async (ctx) =>
		ctx.db.insert('projectCategories', {
			projectType: 'addon',
			name,
			slug: name.toLowerCase(),
			sortOrder: 0,
			isActive: true,
			createdAt: 1,
			updatedAt: 1,
		}),
	)
}

type BrowseArgs = Omit<
	(typeof api.functions.projects.listing.browse)['_args'],
	'paginationOpts'
>

async function browse(t: TestClient, args: BrowseArgs = {}, numItems = 24) {
	return await t.query(api.functions.projects.listing.browse, {
		...args,
		paginationOpts: { cursor: null, numItems },
	})
}

/** Follows the cursor to the end, as the page does when a load comes back short. */
async function browseAll(t: TestClient, args: BrowseArgs, numItems: number) {
	const slugs: string[] = []
	const pageSizes: number[] = []
	let cursor: string | null = null
	for (let guard = 0; guard < 50; guard++) {
		const result: Awaited<ReturnType<typeof browse>> = await t.query(
			api.functions.projects.listing.browse,
			{ ...args, paginationOpts: { cursor, numItems } },
		)
		slugs.push(...result.page.map((project) => project.slug))
		pageSizes.push(result.page.length)
		if (result.isDone) {
			return { slugs, pageSizes }
		}
		cursor = result.continueCursor
	}
	throw new Error('Listing never finished')
}

const slugsOf = (result: Awaited<ReturnType<typeof browse>>) =>
	result.page.map((project) => project.slug)

describe('project listing', () => {
	it('includes normalized content types in sitemap entries and excludes private listings', async () => {
		const t = createTest()
		await addProject(t, { slug: 'addon', type: 'addon' })
		await addProject(t, { slug: 'pack', type: 'resource_pack' })
		await addProject(t, { slug: 'legacy-pack', type: 'texture_pack' })
		await addProject(t, { slug: 'draft', status: 'draft' })
		await addProject(t, { slug: 'pending', moderationStatus: 'pending' })
		const entries = await t.query(api.functions.projects.listing.sitemapEntries, {})
		expect(entries.map(({ slug, type }) => ({ slug, type })).sort((a, b) => a.slug.localeCompare(b.slug))).toEqual([
			{ slug: 'addon', type: 'addon' },
			{ slug: 'legacy-pack', type: 'resource_pack' },
			{ slug: 'pack', type: 'resource_pack' },
		])
	})
	it('orders by each sort and never shows content that is not public', async () => {
		const t = createTest()
		await addProject(
			t,
			{ slug: 'popular', publishedAt: 100, latestVersionAt: 300 },
			{
				totalDownloads: 900,
				averageRating: 3,
				favouriteCount: 2,
				trendingScore: 1,
			},
		)
		await addProject(
			t,
			{ slug: 'loved', publishedAt: 200, latestVersionAt: 100 },
			{
				totalDownloads: 50,
				averageRating: 5,
				favouriteCount: 9,
				trendingScore: 4,
			},
		)
		await addProject(
			t,
			{ slug: 'fresh', publishedAt: 300, latestVersionAt: 200 },
			{
				totalDownloads: 10,
				averageRating: 4,
				favouriteCount: 5,
				trendingScore: 9,
			},
		)
		await addProject(
			t,
			{ slug: 'draft', status: 'draft' },
			{ totalDownloads: 5000 },
		)
		await addProject(
			t,
			{ slug: 'in-review', moderationStatus: 'pending' },
			{ totalDownloads: 5000 },
		)

		// Most downloaded is the default.
		expect(slugsOf(await browse(t))).toEqual(['popular', 'loved', 'fresh'])
		const sorted = async (sort: NonNullable<BrowseArgs['sort']>) =>
			slugsOf(await browse(t, { sort }))
		expect(await sorted('newest')).toEqual(['fresh', 'loved', 'popular'])
		expect(await sorted('updated')).toEqual(['popular', 'fresh', 'loved'])
		expect(await sorted('rating')).toEqual(['loved', 'fresh', 'popular'])
		expect(await sorted('saved')).toEqual(['loved', 'fresh', 'popular'])
		expect(await sorted('trending')).toEqual(['fresh', 'loved', 'popular'])
	})

	it('returns every project exactly once across pages', async () => {
		const t = createTest()
		for (let index = 0; index < 55; index++) {
			await addProject(
				t,
				{ slug: `pack-${String(index).padStart(2, '0')}` },
				{ totalDownloads: index },
			)
		}

		const first = await browse(t, {}, 24)
		expect(first.page).toHaveLength(24)
		expect(first.isDone).toBe(false)
		expect(first.page[0]).toMatchObject({
			slug: 'pack-54',
			totalDownloads: 54,
		})

		const { slugs, pageSizes } = await browseAll(t, {}, 24)
		expect(pageSizes.slice(0, 3)).toEqual([24, 24, 7])
		expect(new Set(slugs).size).toBe(55)
		expect(slugs[slugs.length - 1]).toBe('pack-00')
	})

	it('combines type, category, version, tag, date and detail filters', async () => {
		const t = createTest()
		const magic = await addCategory(t, 'Magic')
		const tech = await addCategory(t, 'Tech')
		await addProject(t, {
			slug: 'wands',
			categoryIds: [magic],
			tags: ['spells', 'survival'],
			supportedGameVersions: ['1.21.80'],
			latestVersionAt: 5000,
			metadata: {
				type: 'addon',
				behaviorPackIncluded: true,
				resourcePackIncluded: true,
				experimentalFeaturesRequired: true,
				dependencies: [],
			},
		})
		await addProject(t, {
			slug: 'machines',
			categoryIds: [tech],
			tags: ['survival'],
			supportedGameVersions: ['1.21.70'],
			latestVersionAt: 1000,
		})
		await addProject(t, {
			slug: 'faithful',
			type: 'resource_pack',
			supportedGameVersions: ['1.21.80'],
			latestVersionAt: 9000,
			metadata: {
				type: 'resource_pack',
				resolution: '32x',
				contentTypes: ['textures', 'ui'],
			},
		})

		const found = async (args: BrowseArgs) =>
			slugsOf(await browse(t, { sort: 'newest', ...args })).sort()
		expect(await found({ type: 'resource_pack' })).toEqual(['faithful'])
		expect(await found({ type: 'addon' })).toEqual(['machines', 'wands'])
		expect(await found({ categoryIds: [magic] })).toEqual(['wands'])
		expect(await found({ categoryIds: [magic, tech] })).toEqual([
			'machines',
			'wands',
		])
		expect(await found({ gameVersion: '1.21.80' })).toEqual([
			'faithful',
			'wands',
		])
		// Tags are normalized, and every one must be present.
		expect(await found({ tags: ['Survival'] })).toEqual([
			'machines',
			'wands',
		])
		expect(await found({ tags: ['survival', 'spells'] })).toEqual(['wands'])
		expect(await found({ updatedAfter: 4000 })).toEqual([
			'faithful',
			'wands',
		])
		expect(await found({ experimentalFeaturesRequired: true })).toEqual([
			'wands',
		])
		expect(
			await found({
				resourcePackResolution: '32x',
				resourcePackContentType: 'ui',
			}),
		).toEqual(['faithful'])
		expect(
			await found({ gameVersion: '1.21.80', categoryIds: [tech] }),
		).toEqual([])
	})

	it('keeps looking past a long run of rows a filter rejects', async () => {
		const t = createTest()
		const rare = await addCategory(t, 'Rare')
		for (let index = 0; index < 450; index++) {
			await addProject(
				t,
				{ slug: `common-${index}` },
				{ totalDownloads: 1000 + index },
			)
		}
		await addProject(
			t,
			{ slug: 'needle', categoryIds: [rare] },
			{ totalDownloads: 1 },
		)

		// One request reads a bounded number of rows, so the first comes back
		// empty but unfinished rather than scanning the whole catalogue.
		const first = await browse(t, { categoryIds: [rare] })
		expect(first.page).toEqual([])
		expect(first.isDone).toBe(false)

		const { slugs } = await browseAll(t, { categoryIds: [rare] }, 24)
		expect(slugs).toEqual(['needle'])
	})

	it('searches name, summary, tags and category names', async () => {
		const t = createTest()
		const furniture = await addCategory(t, 'Furniture')
		await addProject(t, {
			slug: 'cozy',
			name: 'Cozy Homes',
			summary: 'Chairs and lamps for every build',
			categoryIds: [furniture],
			tags: ['decor'],
			supportedGameVersions: ['1.21.80'],
		})
		await addProject(t, {
			slug: 'dragons',
			name: 'Dragon Mounts',
			summary: 'Ride dragons across your world',
		})
		await addProject(t, {
			slug: 'hidden-lamps',
			name: 'Hidden Lamps',
			summary: 'Lamps that are still in review',
			moderationStatus: 'pending',
		})

		const found = async (query: string, args: BrowseArgs = {}) =>
			slugsOf(await browse(t, { query, ...args }))
		expect(await found('lamps')).toEqual(['cozy'])
		expect(await found('decor')).toEqual(['cozy'])
		expect(await found('furniture')).toEqual(['cozy'])
		expect(await found('dragon')).toEqual(['dragons'])
		expect(await found('lamps', { gameVersion: '1.21.70' })).toEqual([])
		expect(await found('lamps', { gameVersion: '1.21.80' })).toEqual([
			'cozy',
		])
		expect(await found('nothing-like-this')).toEqual([])
	})
})
