import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../_generated/api'
import { afterProjectWrite } from '../../lib/activity'
import { notifyProjectRelease } from '../../lib/notificationEvents'
import {
	createTest,
	insertProject,
	insertRelease,
	insertServer,
	signIn,
	type TestClient,
} from '../../test.setup'

beforeEach(() => {
	vi.useFakeTimers()
})
afterEach(() => {
	vi.useRealTimers()
})

const page = { paginationOpts: { numItems: 20, cursor: null } }

async function drain(t: TestClient) {
	await t.finishAllScheduledFunctions(vi.runAllTimers)
}

async function notificationsFor(t: TestClient, userId: string) {
	return t.run((ctx) =>
		ctx.db
			.query('notifications')
			.withIndex('by_userId_and_createdAt', (q) => q.eq('userId', userId))
			.collect(),
	)
}

describe('follows', () => {
	it('refuses private targets but always allows unfollowing', async () => {
		const t = createTest()
		const fan = await signIn(t, 'fan')
		const draft = await insertProject(t, { slug: 'draft', status: 'draft' })
		await expect(
			fan.mutation(api.functions.social.follows.toggle, {
				targetType: 'project',
				targetId: draft,
			}),
		).rejects.toThrow('cannot be followed')

		const live = await insertProject(t, { slug: 'live' })
		const target = { targetType: 'project' as const, targetId: live }
		expect(await fan.mutation(api.functions.social.follows.toggle, target)).toBe(true)
		await t.run((ctx) => ctx.db.patch(live, { status: 'draft' }))
		expect(await fan.mutation(api.functions.social.follows.toggle, target)).toBe(false)
		expect(await t.query(api.functions.social.follows.getState, target)).toEqual({
			isFollowing: false,
			count: 0,
		})
	})

	it('cannot follow yourself', async () => {
		const t = createTest()
		const me = await signIn(t, 'me')
		await expect(
			me.mutation(api.functions.social.follows.toggle, {
				targetType: 'user',
				targetId: me.userId,
			}),
		).rejects.toThrow()
	})

	it('copies creator follower counts into a listing created later', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const fan = await signIn(t, 'fan')
		await fan.mutation(api.functions.social.follows.toggle, {
			targetType: 'user',
			targetId: creator.userId,
		})
		// The creator's first public project creates their listing.
		await t.run(async (ctx) => {
			const id = await ctx.db.insert('projects', {
				type: 'addon',
				slug: 'first',
				name: 'First',
				summary: 's',
				description: 'd',
				categoryIds: [],
				ownerType: 'user',
				ownerId: creator.userId,
				createdBy: creator.userId,
				status: 'published',
				moderationStatus: 'approved',
				updatedAt: Date.now(),
			})
			await afterProjectWrite(ctx, null, await ctx.db.get(id))
		})
		const listing = await t.run((ctx) =>
			ctx.db.query('creatorListings').first(),
		)
		expect(listing?.followerCount).toBe(1)
	})
})

describe('notifications', () => {
	it('tells followers of a listing and its owner about a release once', async () => {
		const t = createTest()
		const fan = await signIn(t, 'fan')
		const ownerFan = await signIn(t, 'ownerfan')
		const projectId = await insertProject(t, { slug: 'pack' })
		await insertRelease(t, projectId, '1.0.0', { publishedAt: 1 })
		const releaseId = await insertRelease(t, projectId, '1.1.0', {
			publishedAt: Date.now(),
		})

		// Follows both the project and its owner: still one notification.
		await fan.mutation(api.functions.social.follows.toggle, {
			targetType: 'project',
			targetId: projectId,
		})
		await t.run((ctx) =>
			ctx.db.insert('follows', {
				userId: fan.userId,
				targetType: 'user',
				targetId: 'owner',
				createdAt: 1,
			}),
		)
		await t.run((ctx) =>
			ctx.db.insert('follows', {
				userId: ownerFan.userId,
				targetType: 'user',
				targetId: 'owner',
				createdAt: 1,
			}),
		)

		const notify = () =>
			t.run(async (ctx) => {
				const release = await ctx.db.get(releaseId)
				if (release) await notifyProjectRelease(ctx, release)
			})
		await notify()
		await notify()
		await drain(t)

		const fanRows = await notificationsFor(t, fan.userId)
		expect(fanRows).toEqual([
			expect.objectContaining({ kind: 'release', version: '1.1.0' }),
		])
		expect(await notificationsFor(t, ownerFan.userId)).toHaveLength(1)
		expect(await fan.query(api.functions.social.notifications.unreadCount, {})).toBe(1)

		const feed = await fan.query(api.functions.social.notifications.listMine, page)
		expect(feed.page[0]?.subject).toMatchObject({ kind: 'Add-on', name: 'pack' })

		await fan.mutation(api.functions.social.notifications.markAllRead, {})
		expect(await fan.query(api.functions.social.notifications.unreadCount, {})).toBe(0)
	})

	it('leaves the first release to the new-listing notification', async () => {
		const t = createTest()
		const fan = await signIn(t, 'fan')
		const projectId = await insertProject(t, { slug: 'fresh' })
		const releaseId = await insertRelease(t, projectId, '1.0.0', {
			publishedAt: Date.now(),
		})
		await fan.mutation(api.functions.social.follows.toggle, {
			targetType: 'project',
			targetId: projectId,
		})
		await t.run(async (ctx) => {
			const release = await ctx.db.get(releaseId)
			if (release) await notifyProjectRelease(ctx, release)
		})
		await drain(t)
		expect(await notificationsFor(t, fan.userId)).toEqual([])
	})

	it('announces a new listing to owner followers, but not old content', async () => {
		const t = createTest()
		const fan = await signIn(t, 'fan')
		await t.run((ctx) =>
			ctx.db.insert('follows', {
				userId: fan.userId,
				targetType: 'user',
				targetId: 'owner',
				createdAt: 1,
			}),
		)
		const publish = (slug: string, publishedAt: number) =>
			t.run(async (ctx) => {
				const id = await ctx.db.insert('projects', {
					type: 'addon',
					slug,
					name: slug,
					summary: 's',
					description: 'd',
					categoryIds: [],
					ownerType: 'user',
					ownerId: 'owner',
					createdBy: 'owner',
					status: 'draft',
					moderationStatus: 'pending',
					updatedAt: Date.now(),
				})
				const before = await ctx.db.get(id)
				await ctx.db.patch(id, {
					status: 'published',
					moderationStatus: 'approved',
					publishedAt,
				})
				await afterProjectWrite(ctx, before, await ctx.db.get(id))
			})
		await publish('new', Date.now())
		await publish('old', Date.now() - 400 * 24 * 60 * 60 * 1000)
		await drain(t)
		const rows = await notificationsFor(t, fan.userId)
		expect(rows).toEqual([expect.objectContaining({ kind: 'listing' })])
	})

	it('skips kinds the person switched off', async () => {
		const t = createTest()
		const fan = await signIn(t, 'fan')
		const projectId = await insertProject(t, { slug: 'quiet' })
		await insertRelease(t, projectId, '1.0.0', { publishedAt: 1 })
		const releaseId = await insertRelease(t, projectId, '2.0.0', {
			publishedAt: Date.now(),
		})
		await fan.mutation(api.functions.social.follows.toggle, {
			targetType: 'project',
			targetId: projectId,
		})
		await fan.mutation(api.functions.social.notifications.updateMyPreferences, {
			disabledKinds: ['release'],
			digest: 'off',
			instantAlertEmails: true,
		})
		await t.run(async (ctx) => {
			const release = await ctx.db.get(releaseId)
			if (release) await notifyProjectRelease(ctx, release)
		})
		await drain(t)
		expect(await notificationsFor(t, fan.userId)).toEqual([])
	})
})

describe('digest', () => {
	it('lists unread notifications since the last digest, then moves on', async () => {
		const t = createTest()
		const reader = await signIn(t, 'reader')
		const projectId = await insertProject(t, { slug: 'digest-pack' })
		await reader.mutation(api.functions.social.notifications.updateMyPreferences, {
			disabledKinds: [],
			digest: 'daily',
			instantAlertEmails: true,
		})
		vi.advanceTimersByTime(1000)
		await t.run((ctx) =>
			ctx.db.insert('notifications', {
				userId: reader.userId,
				kind: 'release',
				eventKey: 'release:project:x',
				subjectType: 'project',
				subjectId: projectId,
				version: '3.0.0',
				createdAt: Date.now(),
			}),
		)
		vi.advanceTimersByTime(1000)
		const args = { userId: reader.userId, frequency: 'daily' as const }
		const first = await t.mutation(internal.functions.social.digest.prepare, args)
		expect(first).toMatchObject({
			to: 'reader@example.com',
			moreCount: 0,
			items: [expect.objectContaining({ title: 'digest-pack 3.0.0' })],
		})
		expect(first?.items[0]?.url).toContain('/addons/')
		expect(await t.mutation(internal.functions.social.digest.prepare, args)).toBeNull()
	})

	it('turns email off from the unsubscribe token', async () => {
		const t = createTest()
		const reader = await signIn(t, 'reader')
		await reader.mutation(api.functions.social.notifications.updateMyPreferences, {
			disabledKinds: [],
			digest: 'weekly',
			instantAlertEmails: true,
		})
		const token = await t.run(
			async (ctx) =>
				(await ctx.db.query('notificationPreferences').first())?.unsubscribeToken,
		)
		expect(await t.mutation(api.functions.social.notifications.unsubscribe, { token: 'x'.repeat(32) })).toBe(false)
		expect(await t.mutation(api.functions.social.notifications.unsubscribe, { token: token ?? '' })).toBe(true)
		expect(await reader.query(api.functions.social.notifications.getMyPreferences, {})).toMatchObject({
			digest: 'off',
			instantAlertEmails: false,
		})
	})
})

describe('collections', () => {
	it('shows public items, hides private collections from others', async () => {
		const t = createTest()
		const curator = await signIn(t, 'curator')
		const visitor = await signIn(t, 'visitor')
		const projectId = await insertProject(t, { slug: 'favourite-pack' })
		const serverId = await insertServer(t, { slug: 'favourite-server' })

		const { _id, publicId } = await curator.mutation(
			api.functions.social.collections.create,
			{ name: '  Best   of 2026 ', visibility: 'public' },
		)
		await curator.mutation(api.functions.social.collections.addItem, {
			collectionId: _id,
			targetType: 'project',
			targetId: projectId,
			note: 'Great with friends',
		})
		await curator.mutation(api.functions.social.collections.addItem, {
			collectionId: _id,
			targetType: 'server',
			targetId: serverId,
		})
		// Adding twice only updates the note.
		await curator.mutation(api.functions.social.collections.addItem, {
			collectionId: _id,
			targetType: 'server',
			targetId: serverId,
		})
		await expect(
			visitor.mutation(api.functions.social.collections.addItem, {
				collectionId: _id,
				targetType: 'server',
				targetId: serverId,
			}),
		).rejects.toThrow('Collection not found')

		const collection = await visitor.query(
			api.functions.social.collections.getByRef,
			{ ref: publicId },
		)
		expect(collection).toMatchObject({ name: 'Best of 2026', itemCount: 2, isOwner: false })

		// A listing that goes private drops out of the collection page.
		await t.run((ctx) => ctx.db.patch(serverId, { status: 'draft' }))
		const items = await visitor.query(api.functions.social.collections.listItems, {
			collectionId: _id,
			...page,
		})
		expect(items.page.filter(Boolean)).toEqual([
			expect.objectContaining({ name: 'favourite-pack', note: 'Great with friends' }),
		])

		await curator.mutation(api.functions.social.collections.update, {
			collectionId: _id,
			visibility: 'private',
		})
		expect(
			await visitor.query(api.functions.social.collections.getByRef, { ref: publicId }),
		).toBeNull()
		expect(
			await visitor.query(api.functions.social.collections.listByUsername, {
				username: 'curator',
			}),
		).toEqual([])
	})
})

describe('account deletion', () => {
	it('removes follows, library, collections and notifications', async () => {
		const t = createTest()
		const leaver = await signIn(t, 'leaver')
		const projectId = await insertProject(t, { slug: 'kept' })
		const target = { targetType: 'project' as const, targetId: projectId }
		await leaver.mutation(api.functions.social.follows.toggle, target)
		await leaver.mutation(api.functions.social.library.toggle, target)
		await leaver.mutation(api.functions.social.collections.create, {
			name: 'Mine',
			visibility: 'public',
		})
		await t.mutation(internal.functions.social.cleanup.removeUserData, {
			userId: leaver.userId,
		})
		await drain(t)
		const left = await t.run(async (ctx) => ({
			follows: await ctx.db.query('follows').collect(),
			favourites: await ctx.db.query('favourites').collect(),
			collections: await ctx.db.query('collections').collect(),
		}))
		expect(left).toEqual({ follows: [], favourites: [], collections: [] })
		expect(await t.query(api.functions.social.follows.getState, target)).toEqual({
			isFollowing: false,
			count: 0,
		})
	})
})
