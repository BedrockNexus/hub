import actionRetrierTest from '@convex-dev/action-retrier/test'
import r2Test from '@convex-dev/r2/test'
import { createFunctionHandle } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, components, internal } from '../_generated/api'
import {
	createTest,
	insertProject,
	signIn,
	type TestClient,
} from '../test.setup'

// convex/lib/r2.ts reads these when it is first imported.
const r2Config = vi.hoisted(() => {
	const config = {
		bucket: 'cdn-test',
		endpoint: 'https://r2.test',
		accessKeyId: 'test',
		secretAccessKey: 'test',
	}
	process.env.R2_CDN_BUCKET = config.bucket
	process.env.R2_ENDPOINT = config.endpoint
	process.env.R2_ACCESS_KEY_ID = config.accessKeyId
	process.env.R2_SECRET_ACCESS_KEY = config.secretAccessKey
	process.env.R2_CDN_PUBLIC_URL = 'https://cdn.test'
	return config
})

const INLINE_PNG = `data:image/png;base64,${'A'.repeat(4000)}`

function createPictureTest() {
	const t = createTest()
	r2Test.register(t)
	// The R2 component deletes objects through its own retrier.
	actionRetrierTest.register(t, 'r2/actionRetrier')
	return t
}

function avatarKey(userId: string, name: string) {
	return `media/profiles/${userId}/avatar/${name}`
}

function cdnUrl(key: string) {
	return `https://cdn.test/${key}`
}

/** Records an object as R2 would after an upload, without touching R2. */
async function putObject(
	t: TestClient,
	key: string,
	overrides: { contentType?: string; size?: number; lastModified?: string } = {},
) {
	await t.mutation(components.r2.lib.upsertMetadata, {
		key,
		bucket: r2Config.bucket,
		contentType: overrides.contentType ?? 'image/png',
		size: overrides.size ?? 30_000,
		lastModified: overrides.lastModified ?? new Date().toISOString(),
		link: '',
	})
}

async function hasObject(t: TestClient, key: string) {
	return (
		(await t.query(components.r2.lib.getMetadata, { key, ...r2Config })) !==
		null
	)
}

/** Writes the way Better Auth does: through the adapter, with the triggers. */
async function saveOwner(
	t: TestClient,
	model: 'user' | 'organization',
	id: string,
	update: { image?: string | null; logo?: string | null },
) {
	const onUpdateHandle = await t.run(async () =>
		createFunctionHandle(internal.auth.onUpdate),
	)
	await t.mutation(components.betterAuth.adapter.updateOne, {
		input: { model, where: [{ field: '_id', value: id }], update },
		onUpdateHandle,
	} as never)
}

async function readOwner(
	t: TestClient,
	model: 'user' | 'organization',
	id: string,
) {
	return (await t.query(components.betterAuth.adapter.findOne, {
		model,
		where: [{ field: '_id', value: id }],
	})) as { image?: string | null; logo?: string | null } | null
}

async function insertOrganization(t: TestClient, name: string, slug: string) {
	const organization = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'organization',
			data: { name, slug, createdAt: Date.now() },
		},
	})
	return organization._id as string
}

async function search(t: TestClient, query: string) {
	return await t.query(api.functions.site.creators.search, { query })
}

describe('avatars and organization logos', () => {
	// Deleting an object schedules a call to R2; nothing here should make it.
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it('saves an uploaded avatar and shows it in creator search', async () => {
		const t = createPictureTest()
		const creator = await signIn(t, 'painter')
		await insertProject(t, {
			slug: 'palette',
			ownerId: creator.userId,
			createdBy: creator.userId,
		})
		const key = avatarKey(creator.userId, 'first.png')
		await putObject(t, key)

		await saveOwner(t, 'user', creator.userId, { image: cdnUrl(key) })

		expect((await readOwner(t, 'user', creator.userId))?.image).toBe(
			cdnUrl(key),
		)
		expect(await search(t, 'painter')).toEqual([
			{
				ownerType: 'user',
				slug: 'painter',
				name: 'painter',
				pictureUrl: cdnUrl(key),
				serverCount: 0,
				projectCount: 1,
				pluginCount: 0,
			},
		])
	})

	it('refuses a picture that is not the account’s own checked upload', async () => {
		const t = createPictureTest()
		const creator = await signIn(t, 'forger')
		const other = await signIn(t, 'victim')
		const otherKey = avatarKey(other.userId, 'theirs.png')
		const missingKey = avatarKey(creator.userId, 'never-uploaded.png')
		const scriptKey = avatarKey(creator.userId, 'script.svg')
		const hugeKey = avatarKey(creator.userId, 'huge.png')
		const bannerKey = `media/profiles/${creator.userId}/banner/wide.png`
		await putObject(t, otherKey)
		await putObject(t, scriptKey, { contentType: 'image/svg+xml' })
		await putObject(t, hugeKey, { size: 2 * 1024 * 1024 })
		await putObject(t, bannerKey)

		const notOwnUpload = /Upload the picture before saving it/
		const notAnImage = /The image must be a PNG, JPG, WebP, or GIF up to 1MB/
		for (const [image, reason] of [
			[INLINE_PNG, notOwnUpload],
			['https://example.com/tracker.png', notOwnUpload],
			[cdnUrl(otherKey), notOwnUpload],
			[cdnUrl(bannerKey), notOwnUpload],
			[`${cdnUrl(missingKey)}?v=2`, notOwnUpload],
			[cdnUrl(missingKey), notAnImage],
			[cdnUrl(scriptKey), notAnImage],
			[cdnUrl(hugeKey), notAnImage],
		] as const) {
			await expect(
				saveOwner(t, 'user', creator.userId, { image }),
			).rejects.toThrow(reason)
		}

		expect((await readOwner(t, 'user', creator.userId))?.image).toBeFalsy()
		expect(await hasObject(t, otherKey)).toBe(true)
	})

	it('deletes the avatar it replaces, and the last one with the account', async () => {
		const t = createPictureTest()
		const creator = await signIn(t, 'restless')
		const first = avatarKey(creator.userId, 'first.png')
		const second = avatarKey(creator.userId, 'second.webp')
		const third = avatarKey(creator.userId, 'third.png')
		await putObject(t, first)
		await putObject(t, second, { contentType: 'image/webp' })
		await putObject(t, third)

		await saveOwner(t, 'user', creator.userId, { image: cdnUrl(first) })
		await saveOwner(t, 'user', creator.userId, { image: cdnUrl(second) })
		expect(await hasObject(t, first)).toBe(false)
		expect(await hasObject(t, second)).toBe(true)

		await saveOwner(t, 'user', creator.userId, { image: null })
		expect(await hasObject(t, second)).toBe(false)

		await saveOwner(t, 'user', creator.userId, { image: cdnUrl(third) })
		const onDeleteHandle = await t.run(async () =>
			createFunctionHandle(internal.auth.onDelete),
		)
		await t.mutation(components.betterAuth.adapter.deleteOne, {
			input: {
				model: 'user',
				where: [{ field: '_id', value: creator.userId }],
			},
			onDeleteHandle,
		})
		expect(await hasObject(t, third)).toBe(false)
	})

	it('holds organization logos to the same rules', async () => {
		const t = createPictureTest()
		const member = await signIn(t, 'founder')
		const organizationId = await insertOrganization(t, 'Voxel Works', 'voxel')
		const otherId = await insertOrganization(t, 'Rival Works', 'rival')
		await insertProject(t, {
			slug: 'voxel-pack',
			ownerType: 'organization',
			ownerId: organizationId,
			createdBy: member.userId,
		})
		const key = `media/organizations/${organizationId}/logo/mark.png`
		const otherKey = `media/organizations/${otherId}/logo/mark.png`
		await putObject(t, key)
		await putObject(t, otherKey)

		await expect(
			saveOwner(t, 'organization', organizationId, { logo: INLINE_PNG }),
		).rejects.toThrow()
		await expect(
			saveOwner(t, 'organization', organizationId, {
				logo: cdnUrl(otherKey),
			}),
		).rejects.toThrow()

		await saveOwner(t, 'organization', organizationId, { logo: cdnUrl(key) })
		expect(await search(t, 'voxel')).toMatchObject([
			{ slug: 'voxel', pictureUrl: cdnUrl(key) },
		])

		// Better Auth UI clears a logo by saving an empty string.
		await saveOwner(t, 'organization', organizationId, { logo: '' })
		expect(await hasObject(t, key)).toBe(false)
		const [listing] = await search(t, 'voxel')
		expect(listing.pictureUrl).toBeUndefined()
	})

	it('keeps inline pictures out of search until they are moved', async () => {
		const t = createPictureTest()
		const legacy = await signIn(t, 'oldtimer')
		const modern = await signIn(t, 'newcomer')
		await insertProject(t, {
			slug: 'relic',
			ownerId: legacy.userId,
			createdBy: legacy.userId,
		})
		// As saved before uploads went to R2: no trigger, picture inline.
		await t.mutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: 'user',
				where: [{ field: '_id', value: legacy.userId }],
				update: { image: INLINE_PNG },
			},
		})
		const modernKey = avatarKey(modern.userId, 'now.png')
		await putObject(t, modernKey)
		await saveOwner(t, 'user', modern.userId, { image: cdnUrl(modernKey) })

		// Other account changes still go through while the picture is inline.
		await saveOwner(t, 'user', legacy.userId, {
			displayUsername: 'Old Timer',
		} as never)
		const [inlineListing] = await search(t, 'oldtimer')
		expect(inlineListing).toMatchObject({ slug: 'oldtimer' })
		expect(inlineListing.pictureUrl).toBeUndefined()

		await t.mutation(
			internal.functions.site.migrations.backfillInlinePictures,
			{},
		)
		const scheduled = await t.run(async (ctx) =>
			ctx.db.system.query('_scheduled_functions').collect(),
		)
		const moves = scheduled.filter((job) =>
			job.name.includes('moveInlinePicture'),
		)
		expect(moves.map((job) => job.args)).toEqual([
			[{ ownerType: 'user', ownerId: legacy.userId }],
		])

		// What moveInlinePicture does once the picture is in R2.
		const movedKey = avatarKey(legacy.userId, 'moved.png')
		await putObject(t, movedKey)
		await t.mutation(internal.functions.site.migrations.saveMovedPicture, {
			ownerType: 'user',
			ownerId: legacy.userId,
			key: movedKey,
			inlineLength: INLINE_PNG.length,
		})
		expect((await readOwner(t, 'user', legacy.userId))?.image).toBe(
			cdnUrl(movedKey),
		)
		expect(await search(t, 'oldtimer')).toMatchObject([
			{ pictureUrl: cdnUrl(movedKey) },
		])

		// A second run finds a picture that is no longer inline and steps aside.
		const lateKey = avatarKey(legacy.userId, 'late.png')
		await putObject(t, lateKey)
		await t.mutation(internal.functions.site.migrations.saveMovedPicture, {
			ownerType: 'user',
			ownerId: legacy.userId,
			key: lateKey,
			inlineLength: INLINE_PNG.length,
		})
		expect((await readOwner(t, 'user', legacy.userId))?.image).toBe(
			cdnUrl(movedKey),
		)
		expect(await hasObject(t, lateKey)).toBe(false)
		expect(await hasObject(t, movedKey)).toBe(true)
	})

	it('cleans up abandoned uploads but never a picture in use', async () => {
		const t = createPictureTest()
		const creator = await signIn(t, 'keeper')
		const organizationId = await insertOrganization(t, 'Keep Co', 'keep')
		const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
		const avatar = avatarKey(creator.userId, 'current.png')
		const abandonedAvatar = avatarKey(creator.userId, 'abandoned.png')
		const logo = `media/organizations/${organizationId}/logo/current.png`
		const abandonedLogo = `media/organizations/${organizationId}/logo/abandoned.png`
		for (const key of [avatar, abandonedAvatar, logo, abandonedLogo]) {
			await putObject(t, key, { lastModified: lastWeek })
		}
		await saveOwner(t, 'user', creator.userId, { image: cdnUrl(avatar) })
		await saveOwner(t, 'organization', organizationId, { logo: cdnUrl(logo) })

		await t.mutation(
			internal.functions.storage.cleanupStaleManagedR2Uploads,
			{},
		)

		expect(await hasObject(t, avatar)).toBe(true)
		expect(await hasObject(t, logo)).toBe(true)
		expect(await hasObject(t, abandonedAvatar)).toBe(false)
		expect(await hasObject(t, abandonedLogo)).toBe(false)
	})
})
