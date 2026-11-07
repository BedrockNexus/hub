// biome-ignore-all lint/suspicious/noSkippedTests: Provisioned writes require explicit operator opt-in.
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import {
	type Browser,
	type BrowserContext,
	expect,
	type Page,
	type TestInfo,
	test,
} from '@playwright/test'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import {
	type PublishingFixture,
	provisionPublishingFixture,
	type Role,
	type TestListing,
} from './support/publishing-fixtures'

const MODERATOR_REQUIRED = /Moderator role/i
const ADMIN_REQUIRED = /Admin role/i
const ADMIN_EDIT_REQUIRED = /admin|moderation/i
const LOGIN = /\/login(?:\?|$)/
const DASHBOARD = /\/dashboard(?:\?|$)/
const SUBMIT = /^(?:(?:Submit|Resubmit) for review|Submit updates)$/
const CLAIMED_BY_ANOTHER = /assigned to another/i
const CLAIM = /^(?:Claim|Release) review$/
const SAVE = /^Save Changes$/
const REASON =
	'Please clarify the installation steps for this acceptance fixture.'

test.describe('publishing acceptance', () => {
	test.skip(
		process.env.E2E_PUBLISHING !== '1',
		'Set E2E_PUBLISHING=1 to provision isolated fixtures',
	)
	test.describe.configure({ mode: 'serial', retries: 0, timeout: 180_000 })
	let fixture: PublishingFixture
	let contexts: BrowserContext[] = []
	const errors: string[] = []
	async function asRole(browser: Browser, info: TestInfo, role?: Role) {
		const context = await browser.newContext({
			baseURL: fixture.baseURL,
			storageState: role ? fixture.accounts[role].storage : undefined,
			viewport: info.project.use.viewport,
			isMobile: info.project.use.isMobile,
			hasTouch: info.project.use.hasTouch,
			userAgent: info.project.use.userAgent,
		})
		context.setDefaultTimeout(30_000)
		context.setDefaultNavigationTimeout(60_000)
		contexts.push(context)
		const page = await context.newPage()
		page.on('pageerror', (error) => errors.push(error.message))
		return page
	}
	function readListing(listing: TestListing) {
		return listing.kind === 'server'
			? fixture.accounts.creator.client.query(
					api.functions.servers.servers.getForEdit,
					{ id: listing.id },
				)
			: fixture.accounts.creator.client.query(
					api.functions.projects.projects.getForEdit,
					{ id: listing.id as Id<'projects'> },
				)
	}
	async function savedSummary(listing: TestListing, expected: string) {
		await expect
			.poll(
				async () => {
					const current = await readListing(listing)
					return (
						current &&
						('summary' in current
							? current.summary
							: current.smallDescription)
					)
				},
				{ timeout: 30_000 },
			)
			.toBe(expected)
	}

	async function reviewStatus(listing: TestListing, status: string) {
		await expect
			.poll(async () => (await readListing(listing))?.submissionStatus, {
				timeout: 30_000,
			})
			.toBe(status)
	}
	async function submit(page: Page, listing: TestListing, mobile: boolean) {
		await page.goto(
			listing.kind === 'server' ? listing.edit : `${listing.edit}/review`,
		)
		if (listing.kind === 'server' && mobile) {
			await page
				.getByRole('button', { name: 'Toggle Sidebar', exact: true })
				.click()
		}
		await page.getByRole('button', { name: SUBMIT }).last().click()
		await reviewStatus(listing, 'pending')
	}
	async function decide(
		page: Page,
		decision: 'Approve' | 'Request changes',
		reason?: string,
	) {
		await page
			.getByRole('complementary', { name: 'Review decision' })
			.getByRole('button', { name: decision, exact: true })
			.click()
		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()
		if (reason) {
			await dialog.getByLabel('Reason for creator').fill(reason)
		}
		await dialog
			.getByRole('button', { name: decision, exact: true })
			.click()
		await expect(dialog).not.toBeVisible()
	}
	test.beforeAll(async ({ baseURL }, info) => {
		test.setTimeout(300_000)
		fixture = await provisionPublishingFixture(
			baseURL ?? 'http://localhost:3000',
			info.project.name,
		)
	})
	test.afterEach(async ({ context }, info) => {
		contexts.push(context)
		if (fixture && info.status !== info.expectedStatus) {
			for (const [index, context] of contexts.entries()) {
				const page = context.pages()[0]
				if (page) {
					await page
						.screenshot({
							path: `${fixture.directory}/failure-${index}.png`,
							fullPage: true,
						})
						.catch(() => undefined)
					writeFileSync(
						`${fixture.directory}/failure-${index}.txt`,
						await page
							.locator('body')
							.innerText()
							.catch(() => ''),
					)
				}
			}
		}
		await Promise.all(contexts.map((context) => context.close()))
		contexts = []
		expect(errors.splice(0), 'Browser application errors').toEqual([])
	})
	test.afterAll(async () => {
		test.setTimeout(120_000)
		if (fixture) {
			await fixture.cleanup()
		}
	})
	test('real sign-in and creator, moderator, admin permission boundaries', async ({
		browser,
	}, info) => {
		for (const role of ['creator', 'moderator', 'admin'] as const) {
			console.info(`Checking ${info.project.name} ${role} sign-in`)
			const page = await asRole(browser, info)
			await Promise.all([
				page.waitForResponse((response) =>
					response.url().endsWith('/api/auth/get-session'),
				),
				page.goto('/login'),
			])
			await page
				.getByRole('textbox', { name: 'Username', exact: true })
				.fill(fixture.accounts[role].username)
			await page
				.getByLabel('Password', { exact: true })
				.fill(fixture.accounts[role].password)
			await expect
				.poll(async () =>
					page
						.getByLabel('Password', { exact: true })
						.inputValue()
						.then((value) => value.length),
				)
				.toBe(fixture.accounts[role].password.length)
			const [login] = await Promise.all([
				page.waitForResponse(
					(response) => response.url().includes('/api/auth/sign-in/'),
					{ timeout: 30_000 },
				),
				page
					.getByRole('button', { name: 'Login', exact: true })
					.click(),
			])
			if (!login.ok()) {
				const failure = await login.json()
				throw new Error(
					`Browser sign-in as ${role}: ${failure.code}: ${failure.message}`,
				)
			}
			await expect(page).not.toHaveURL(LOGIN, { timeout: 30_000 })
			console.info(`Signed in as ${role}; checking permissions`)
			await page.goto('/moderation')
			if (role === 'creator') {
				await expect(page).toHaveURL(DASHBOARD)
			} else {
				await expect(
					page.getByRole('heading', {
						name: 'Awaiting review',
						exact: true,
					}),
				).toBeVisible()
			}
			await page.goto('/admin/users')
			if (role === 'admin') {
				await expect(
					page.getByRole('heading', { name: 'Users', exact: true }),
				).toBeVisible()
			} else {
				await expect(page).toHaveURL(DASHBOARD)
			}
		}
		await expect(
			fixture.accounts.creator.client.query(
				api.functions.moderation.work.queue,
				{},
			),
		).rejects.toThrow(MODERATOR_REQUIRED)
		await expect(
			fixture.accounts.moderator.client.query(
				api.functions.site.users.listAdmin,
				{
					now: Date.now(),
					paginationOpts: { numItems: 1, cursor: null },
				},
			),
		).rejects.toThrow(ADMIN_REQUIRED)
		const server = fixture.listings.find(
			(listing) => listing.kind === 'server',
		)
		if (!server) {
			throw new Error('Missing server fixture')
		}
		await expect(
			fixture.accounts.moderator.client.mutation(
				api.functions.servers.servers.updateAdmin,
				{ id: server.id as Id<'servers'>, name: 'Forbidden edit' },
			),
		).rejects.toThrow(ADMIN_EDIT_REQUIRED)
		const adminPage = await asRole(browser, info, 'admin')
		await adminPage.goto('/admin/users')
		await adminPage
			.getByRole('searchbox', { name: 'Search users', exact: true })
			.fill(fixture.accounts.moderator.username)
		await expect(adminPage.locator('tbody tr')).toHaveCount(1)
		const userRow = adminPage
			.getByRole('row')
			.filter({ hasText: fixture.accounts.moderator.username })
		for (const label of ['Make User', 'Make Moderator']) {
			await userRow
				.getByRole('button', { name: 'Open menu', exact: true })
				.click()
			await adminPage
				.getByRole('menuitem', { name: label, exact: true })
				.click()
			await adminPage
				.getByRole('alertdialog')
				.getByRole('button', { name: label, exact: true })
				.click()
			await expect(
				userRow.getByText(
					label === 'Make User' ? 'User' : 'Moderator',
					{ exact: true },
				),
			).toBeVisible()
		}
	})
	for (const kind of ['addon', 'resource_pack', 'server'] as const) {
		test(`${kind}: submit, claim, correct, resubmit, approve and retain approved content during edits`, async ({
			browser,
		}, info) => {
			const listing = fixture.listings.find((item) => item.kind === kind)
			if (!listing) {
				throw new Error(`Missing ${kind} fixture`)
			}
			console.info(`Checking ${info.project.name} ${kind} publishing`)
			const mobile = !!info.project.use.isMobile
			const creator = await asRole(browser, info, 'creator')
			const moderator = await asRole(browser, info, 'moderator')
			const visitor = await asRole(browser, info)
			await visitor.goto(listing.public)
			await expect(
				visitor.getByRole('heading', {
					name: listing.name,
					exact: true,
				}),
			).toHaveCount(0)
			await submit(creator, listing, mobile)
			await moderator.goto(listing.review)
			const bar = moderator.getByRole('complementary', {
				name: 'Review decision',
			})
			await expect(bar.getByRole('button', { name: CLAIM })).toBeEnabled()
			await bar
				.getByRole('button', { name: 'Claim review', exact: true })
				.click()
			await expect(
				bar.getByRole('button', {
					name: 'Release review',
					exact: true,
				}),
			).toBeEnabled()
			await expect(
				bar.getByText(fixture.accounts.moderator.username, {
					exact: true,
				}),
			).toBeVisible()
			const assignment = await fixture.accounts.admin.client.query(
				api.functions.moderation.work.assignment,
				{
					contentId: listing.id as Id<'projects'> | Id<'servers'>,
					revision:
						(await readListing(listing))?.submissionRevision ?? 0,
				},
			)
			expect(assignment.mine).toBe(false)
			expect(assignment.assignee).toBe(
				fixture.accounts.moderator.username,
			)
			const expectedRevision =
				(await readListing(listing))?.submissionRevision ?? 0
			const competingDecision =
				kind === 'server'
					? fixture.accounts.admin.client.mutation(
							api.functions.servers.servers.updateAdmin,
							{
								id: listing.id as Id<'servers'>,
								status: 'published',
								moderationStatus: 'approved',
								expectedRevision,
							},
						)
					: fixture.accounts.admin.client.mutation(
							api.functions.projects.projects.adminUpdate,
							{
								id: listing.id as Id<'projects'>,
								status: 'published',
								moderationStatus: 'approved',
								expectedRevision,
							},
						)
			await expect(competingDecision).rejects.toThrow(CLAIMED_BY_ANOTHER)

			await decide(moderator, 'Request changes', REASON)
			await reviewStatus(listing, 'changes_requested')
			await creator.goto(
				kind === 'server' ? listing.edit : `${listing.edit}/review`,
			)
			// The banner reads "Moderator feedback: <reason>", the only copy on mobile.
			await expect(creator.getByText(REASON).first()).toBeVisible()
			await creator.goto(listing.edit)
			const summary = `Installation instructions corrected for automated acceptance ${fixture.runId}.`
			const input = creator.locator(
				kind === 'server'
					? '[name="smallDescription"]'
					: '[name="summary"]',
			)
			await input.fill(summary)
			await creator.getByRole('button', { name: SAVE }).click()
			await expect(
				creator.getByRole('button', { name: SAVE }),
			).toBeDisabled()
			await savedSummary(listing, summary)
			await submit(creator, listing, mobile)
			await moderator.goto(listing.review)
			await decide(moderator, 'Approve')
			await reviewStatus(listing, 'approved')
			console.info(
				`${kind} approved; checking public content and downloads`,
			)
			await visitor.goto(listing.public)
			await expect(
				visitor.getByRole('heading', {
					name: listing.name,
					exact: true,
				}),
			).toBeVisible({ timeout: 60_000 })
			await expect(
				visitor.getByText(summary, { exact: true }).first(),
			).toBeVisible()
			if (listing.fileHash) {
				let result: { url: string } | undefined
				await expect
					.poll(
						async () => {
							const response = await visitor.request.get(
								`${listing.public}/download/1.0.0?format=json`,
							)
							if (response.ok()) {
								result = await response.json()
							}
							return response.status()
						},
						{ timeout: 60_000, intervals: [1000, 2000, 4000] },
					)
					.toBe(200)
				if (!result) {
					throw new Error('Missing published download URL')
				}
				const download = await visitor.request.get(result.url)
				expect(download.ok()).toBe(true)
				expect(
					createHash('sha256')
						.update(await download.body())
						.digest('hex'),
				).toBe(listing.fileHash)
			}
			// A pending metadata correction must not replace the approved public snapshot.
			await creator.goto(listing.edit)
			const draftSummary = `Pending correction remains private for ${fixture.runId}.`
			await creator
				.locator(
					kind === 'server'
						? '[name="smallDescription"]'
						: '[name="summary"]',
				)
				.fill(draftSummary)
			await creator.getByRole('button', { name: SAVE }).click()
			await expect(
				creator.getByRole('button', { name: SAVE }),
			).toBeDisabled()
			await savedSummary(listing, draftSummary)
			await submit(creator, listing, mobile)
			await visitor.goto(listing.public)
			await expect(
				visitor.getByText(summary, { exact: true }).first(),
			).toBeVisible()
			await expect(
				visitor.getByText(draftSummary, { exact: true }),
			).toHaveCount(0)
			await moderator.goto(`${listing.review}?section=changes`)
			await expect(
				moderator.getByText(draftSummary, { exact: true }).first(),
			).toBeVisible()
			await decide(
				moderator,
				'Request changes',
				'Acceptance complete: keep the approved public snapshot.',
			)
			await reviewStatus(listing, 'changes_requested')
			await moderator.goto(`${listing.review}?section=history`)
			await expect(
				moderator
					.getByText('Approved for publication', { exact: true })
					.first(),
			).toBeVisible()
			await expect
				.poll(() =>
					moderator.evaluate(
						() =>
							document.documentElement.scrollWidth <=
							window.innerWidth,
					),
				)
				.toBe(true)
			await moderator.screenshot({
				path: `${fixture.directory}/${kind}-${info.project.name}.png`,
				fullPage: true,
			})
			writeFileSync(
				`${fixture.directory}/${kind}-accepted.json`,
				JSON.stringify(
					{
						kind,
						listing: listing.id,
						acceptedAt: new Date().toISOString(),
						checks: [
							'creator submission',
							'moderator claim',
							'feedback',
							'creator correction',
							'resubmission',
							'approval',
							'public visibility',
							'approved snapshot preserved',
							...(listing.fileHash
								? [
										'artifact validation API',
										'download byte identity',
									]
								: ['manual ownership proof fixture']),
						],
					},
					null,
					2,
				),
			)
		})
	}
})
