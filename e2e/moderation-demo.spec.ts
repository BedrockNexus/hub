// biome-ignore-all lint/suspicious/noSkippedTests: Requires local development-only fixtures.

import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const LOGIN_URL = /\/login/

import { expect, test } from '@playwright/test'

test('dummy creator and moderator complete the listing review flow', async ({
	page,
}) => {
	test.skip(
		!existsSync(`${tmpdir()}/nexus-review-demo.json`),
		'Requires local development review fixtures',
	)
	const fixture = JSON.parse(
		readFileSync(`${tmpdir()}/nexus-review-demo.json`, 'utf8'),
	)
	const ids = JSON.parse(fixture.result).ids as string[]
	test.setTimeout(180_000)
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	async function login(username: string) {
		await page.goto('/login')
		await page
			.getByRole('textbox', { name: 'Username', exact: true })
			.fill(`${username}@example.invalid`)
		await page
			.getByLabel('Password', { exact: true })
			.fill(fixture.password)
		await expect(page.getByLabel('Password', { exact: true })).toHaveValue(
			fixture.password,
		)
		await page.getByRole('button', { name: 'Login', exact: true }).click()
		await expect(page).not.toHaveURL(LOGIN_URL, { timeout: 30_000 })
	}
	async function logout() {
		await page.goto('/')
		await page.request.post('/api/auth/sign-out', {
			headers: { origin: 'http://localhost:3000' },
			data: {},
		})
	}
	await login('nexus-review-admin')
	await page.goto('/admin')
	await expect(
		page.getByText('Awaiting review:', { exact: false }),
	).toBeVisible()
	const id = ids[Number(process.env.E2E_REVIEW_FIXTURE_INDEX ?? 0)]
	const queueRow = page.getByRole('row').filter({
		hasText:
			process.env.E2E_REVIEW_FIXTURE_INDEX === '1'
				? 'Review Demo resource_pack'
				: 'Review Demo addon',
	})
	await queueRow
		.getByRole('button', { name: 'Claim review', exact: true })
		.click()
	await expect(
		queueRow.getByRole('button', { name: 'Release review', exact: true }),
	).toBeVisible()
	await queueRow
		.getByRole('button', { name: 'Release review', exact: true })
		.click()

	await page.goto(`/admin/projects/${id}`)
	await expect(
		page.getByText('Changes in this submission', { exact: true }),
	).toBeVisible()
	await page
		.getByRole('button', { name: 'Request changes', exact: true })
		.click()
	await page
		.getByRole('dialog')
		.getByLabel('Reason for creator')
		.fill('Browser test: clarify installation instructions.')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Request changes', exact: true })
		.click()
	await expect(
		page.getByText('Changes requested', { exact: true }).first(),
	).toBeVisible()
	await logout()
	await login('nexus-demo-studio')
	await page.goto('/dashboard')
	await expect(
		page
			.getByText('Browser test: clarify installation instructions.', {
				exact: true,
			})
			.first(),
	).toBeVisible()
	await page.goto(
		`/dashboard/${process.env.E2E_REVIEW_FIXTURE_INDEX === '1' ? 'resource-packs' : 'addons'}/${id}/review`,
	)
	await page
		.getByRole('button', { name: 'Submit for review', exact: true })
		.click()
	await expect(
		page.getByText('Your submission is awaiting moderator review.'),
	).toBeVisible()
	await logout()
	await login('nexus-review-admin')
	await page.goto(`/admin/projects/${id}`)
	await page.getByRole('button', { name: 'Approve', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Approve', exact: true })
		.click()
	await expect(
		page.getByRole('button', { name: 'Flag', exact: true }),
	).toBeVisible()
	for (const action of ['Flag', 'Unpublish']) {
		await page.getByRole('button', { name: action, exact: true }).click()
		await page
			.getByRole('dialog')
			.getByLabel('Reason for creator')
			.fill('Browser test: temporary moderation check.')
		await page
			.getByRole('dialog')
			.getByRole('button', {
				name: action === 'Flag' ? 'Flag for Review' : 'Unpublish',
				exact: true,
			})
			.click()
		await expect(
			page.getByRole('button', { name: 'Restore', exact: true }),
		).toBeVisible()
		await page.getByRole('button', { name: 'Restore', exact: true }).click()
		await page
			.getByRole('dialog')
			.getByRole('button', { name: 'Approve', exact: true })
			.click()
		await expect(
			page.getByRole('button', { name: 'Flag', exact: true }),
		).toBeVisible()
	}
	await page.getByText('Moderation history', { exact: true }).click()
	await expect(
		page.getByText('Approved for publication', { exact: true }).first(),
	).toBeVisible()

	await page.goto('/admin/plugins')
	await page
		.getByRole('button', {
			name: 'Actions for Nexus Essentials (Demo)',
			exact: true,
		})
		.click()
	await page
		.getByRole('menuitem', { name: 'Review submission', exact: true })
		.click()
	await expect(
		page.getByRole('button', { name: 'Flag', exact: true }),
	).toBeVisible()
	for (const action of ['Flag', 'Unpublish']) {
		await page.getByRole('button', { name: action, exact: true }).click()
		await page
			.getByRole('dialog')
			.getByLabel('Reason for creator')
			.fill('Browser plugin moderation check.')
		await page
			.getByRole('dialog')
			.getByRole('button', {
				name: action === 'Flag' ? 'Flag for Review' : 'Unpublish',
				exact: true,
			})
			.click()
		await page.getByRole('button', { name: 'Restore', exact: true }).click()
		await page
			.getByRole('dialog')
			.getByRole('button', { name: 'Approve', exact: true })
			.click()
		await expect(
			page.getByRole('button', { name: 'Flag', exact: true }),
		).toBeVisible()
	}
	expect(errors).toEqual([])
})
