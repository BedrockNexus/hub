import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../_generated/api'
import { createTest, insertProject, insertServer } from '../../test.setup'
import { afterProjectWrite, afterServerWrite } from '../../lib/activity'
import {
	stageAnnouncement,
	wakeAnnouncement,
} from '../../lib/discordAnnouncements'

const webhook = 'https://discord.com/api/webhooks/123456/test-token'
beforeEach(() => {
	vi.useFakeTimers()
	vi.stubEnv('DISCORD_ANNOUNCEMENTS_ENABLED', 'true')
	vi.stubEnv('DISCORD_ANNOUNCEMENTS_WEBHOOK_URL', webhook)
	vi.stubEnv('SITE_URL', 'https://bedrocknexus.com')
})
afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

async function firstServer(t: ReturnType<typeof createTest>, approved = true) {
	const serverId = await insertServer(t, {
		slug: 'discord-server',
		status: 'draft',
	})
	await t.run(async (ctx) => {
		const before = await ctx.db.get(serverId)
		await ctx.db.patch(serverId, {
			status: 'published',
			publishedAt: Date.now(),
			moderationStatus: approved ? 'approved' : 'pending',
		})
		await afterServerWrite(ctx, before, await ctx.db.get(serverId))
	})
	const row = await t.run((ctx) =>
		ctx.db.query('discordAnnouncements').first(),
	)
	return { serverId, announcementId: row!._id }
}

describe('first-publication announcements', () => {
	it('stages a new server but waits for moderator approval', async () => {
		const t = createTest()
		const { serverId, announcementId } = await firstServer(t, false)
		expect(
			await t.mutation(
				internal.functions.site.discordAnnouncements.prepare,
				{ id: announcementId },
			),
		).toBeNull()
		await t.run(async (ctx) => {
			const before = await ctx.db.get(serverId)
			await ctx.db.patch(serverId, { moderationStatus: 'approved' })
			await afterServerWrite(ctx, before, await ctx.db.get(serverId))
		})
		expect(
			await t.mutation(
				internal.functions.site.discordAnnouncements.prepare,
				{ id: announcementId },
			),
		).toMatchObject({ attempt: 1, content: { category: 'Server' } })
	})

	it('does not announce existing content, republishing, or edits after enabling', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'existing' })
		await t.run(async (ctx) => {
			await ctx.db.patch(serverId, {
				publishedAt: 1,
				moderationStatus: 'approved',
			})
			const before = await ctx.db.get(serverId)
			await ctx.db.patch(serverId, { status: 'draft' })
			await afterServerWrite(ctx, before, await ctx.db.get(serverId))
			const hidden = await ctx.db.get(serverId)
			await ctx.db.patch(serverId, { status: 'published' })
			await afterServerWrite(ctx, hidden, await ctx.db.get(serverId))
		})
		expect(
			await t.run((ctx) => ctx.db.query('discordAnnouncements').take(5)),
		).toEqual([])
	})

	it('stages a project published before approval without losing its first publication', async () => {
		const t = createTest()
		const projectId = await insertProject(t, {
			slug: 'pending-publication',
			status: 'draft',
			moderationStatus: 'pending',
		})
		await t.run(async (ctx) => {
			const before = await ctx.db.get(projectId)
			await ctx.db.patch(projectId, {
				status: 'published',
				publishedAt: Date.now(),
			})
			await afterProjectWrite(ctx, before, await ctx.db.get(projectId))
		})
		const row = await t.run((ctx) =>
			ctx.db.query('discordAnnouncements').first(),
		)
		expect(row).toMatchObject({
			kind: 'project',
			targetId: projectId,
			status: 'waiting',
		})
		expect(
			await t.mutation(
				internal.functions.site.discordAnnouncements.prepare,
				{ id: row!._id },
			),
		).toBeNull()
		await t.run(async (ctx) => {
			const before = await ctx.db.get(projectId)
			await ctx.db.patch(projectId, { moderationStatus: 'approved' })
			await afterProjectWrite(ctx, before, await ctx.db.get(projectId))
		})
		expect(await t.run((ctx) => ctx.db.get(row!._id))).toMatchObject({
			status: 'pending',
			attempts: 0,
		})
	})

	it.each(['addon', 'resource_pack'] as const)(
		'waits for a downloadable %s release',
		async (type) => {
			const t = createTest()
			const projectId = await insertProject(t, {
				slug: type,
				type,
				status: 'under_review',
				moderationStatus: 'pending',
			})
			const versionId = await t.run(async (ctx) => {
				const versionId = await ctx.db.insert('projectVersions', {
					projectId,
					version: '1.0.0',
					r2Key: 'uploads/file',
					uploadR2Key: 'uploads/file',
					fileName: 'file.mcpack',
					fileSize: 20,
					downloads: 0,
					createdAt: 1,
					validationStatus: 'valid',
					reviewStatus: 'approved',
				})
				const before = await ctx.db.get(projectId)
				await ctx.db.patch(projectId, {
					status: 'published',
					moderationStatus: 'approved',
					publishedAt: Date.now(),
					latestVersionId: versionId,
				})
				await afterProjectWrite(
					ctx,
					before,
					await ctx.db.get(projectId),
				)
				return versionId
			})
			const row = await t.run((ctx) =>
				ctx.db.query('discordAnnouncements').first(),
			)
			expect(
				await t.mutation(
					internal.functions.site.discordAnnouncements.prepare,
					{ id: row!._id },
				),
			).toBeNull()
			await t.run(async (ctx) => {
				await ctx.db.patch(versionId, { cdnR2Key: 'cdn/file' })
				await wakeAnnouncement(ctx, 'project', projectId)
			})
			expect(
				await t.mutation(
					internal.functions.site.discordAnnouncements.prepare,
					{ id: row!._id },
				),
			).toMatchObject({
				content: {
					category: type === 'addon' ? 'Add-on' : 'Resource pack',
				},
			})
		},
	)

	it('sends once during normal retries and stores the Discord message ID', async () => {
		const t = createTest()
		const { announcementId } = await firstServer(t)
		const send = vi.fn(async (_url: unknown, _init?: RequestInit) =>
			Response.json({ id: 'discord-message' }),
		)
		vi.stubGlobal('fetch', send)
		await t.action(
			internal.functions.site.discordAnnouncementDelivery.deliver,
			{ id: announcementId },
		)
		await t.action(
			internal.functions.site.discordAnnouncementDelivery.deliver,
			{ id: announcementId },
		)
		expect(send).toHaveBeenCalledTimes(1)
		const body = JSON.parse(send.mock.calls[0]![1]!.body as string)
		expect(body.allowed_mentions).toEqual({ parse: [] })
		expect(await t.run((ctx) => ctx.db.get(announcementId))).toMatchObject({
			status: 'sent',
			messageId: 'discord-message',
			attempts: 1,
		})
	})

	it('handles rate limits and redacts network errors', async () => {
		const t = createTest()
		const { announcementId } = await firstServer(t)
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({ retry_after: 2 }, { status: 429 }),
			),
		)
		await t.action(
			internal.functions.site.discordAnnouncementDelivery.deliver,
			{ id: announcementId },
		)
		expect(await t.run((ctx) => ctx.db.get(announcementId))).toMatchObject({
			status: 'pending',
			attempts: 1,
			lastError: 'Discord returned HTTP 429.',
		})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error(webhook)
			}),
		)
		await t.action(
			internal.functions.site.discordAnnouncementDelivery.deliver,
			{ id: announcementId },
		)
		const row = await t.run((ctx) => ctx.db.get(announcementId))
		expect(row).toMatchObject({
			status: 'pending',
			lastError: 'Discord request did not complete.',
		})
		expect(JSON.stringify(row)).not.toContain('test-token')
	})

	it('recovers a crashed worker and caps attempts', async () => {
		const t = createTest()
		const { announcementId } = await firstServer(t)
		const prepared = await t.mutation(
			internal.functions.site.discordAnnouncements.prepare,
			{ id: announcementId },
		)
		vi.setSystemTime(Date.now() + 120_001)
		await t.mutation(
			internal.functions.site.discordAnnouncements.recoverLease,
			{ id: announcementId, attempt: prepared!.attempt },
		)
		expect(await t.run((ctx) => ctx.db.get(announcementId))).toMatchObject({
			status: 'pending',
		})
		await t.run((ctx) => ctx.db.patch(announcementId, { attempts: 5 }))
		expect(
			await t.mutation(
				internal.functions.site.discordAnnouncements.prepare,
				{ id: announcementId },
			),
		).toBeNull()
		expect(await t.run((ctx) => ctx.db.get(announcementId))).toMatchObject({
			status: 'failed',
		})
	})

	it('stays off without explicit enablement and skips queued work when disabled', async () => {
		const t = createTest()
		const { announcementId } = await firstServer(t)
		vi.stubEnv('DISCORD_ANNOUNCEMENTS_ENABLED', 'false')
		expect(
			await t.mutation(
				internal.functions.site.discordAnnouncements.prepare,
				{ id: announcementId },
			),
		).toBeNull()
		await t.run((ctx) => stageAnnouncement(ctx, 'server', 'another-id'))
		expect(
			await t.run((ctx) => ctx.db.query('discordAnnouncements').take(5)),
		).toHaveLength(1)
	})
})
