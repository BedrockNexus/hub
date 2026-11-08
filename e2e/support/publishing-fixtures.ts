import { spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type APIRequestContext, expect, request } from '@playwright/test'
import { hashPassword } from 'better-auth/crypto'
import { ConvexHttpClient } from 'convex/browser'
import { strToU8, zipSync } from 'fflate'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { contentHref } from '../../lib/content-routes'

const METADATA_PENDING = /uploaded artifact could not be found in storage/

export type Role = 'creator' | 'moderator' | 'admin'
export type ContentKind = 'addon' | 'resource_pack' | 'server'
export interface TestAccount {
	id: string
	username: string
	email: string
	password: string
	storage: string
	client: ConvexHttpClient
	request: APIRequestContext
}
export interface TestListing {
	id: string
	kind: ContentKind
	name: string
	slug: string
	edit: string
	review: string
	public: string
	fileHash?: string
}
export interface PublishingFixture {
	runId: string
	baseURL: string
	directory: string
	production: boolean
	accounts: Record<Role, TestAccount>
	listings: TestListing[]
	cleanup: () => Promise<void>
}

// These operations require the operator's existing Convex CLI credentials.
// Account creation and the manual server ownership proof are prerequisites;
// every subsequent upload, submission, decision and download uses real APIs.
function convexCLI(production: boolean, args: string[]) {
	const result = spawnSync(
		process.execPath,
		[
			resolve('node_modules/convex/bin/main.js'),
			...args,
			...(production ? ['--prod'] : ['--deployment', 'dev']),
		],
		{
			encoding: 'utf8',
			windowsHide: true,
			env: { ...process.env, NO_COLOR: '1' },
		},
	)
	if (result.status !== 0 || result.error || result.stderr.includes('✖')) {
		// CLI arguments may contain password hashes. Never echo the command.
		throw new Error(
			`Convex fixture operation failed: ${result.stderr.slice(-1200)}`,
		)
	}
	return result.stdout.trim()
}
function operatorRun(
	production: boolean,
	name: string,
	args: unknown,
	component?: string,
) {
	const output = convexCLI(production, [
		'run',
		name,
		JSON.stringify(args),
		'--codegen',
		'disable',
		...(component ? ['--component', component] : []),
	])
	return output ? JSON.parse(output) : null
}
function inspect(production: boolean, code: string) {
	return JSON.parse(convexCLI(production, ['run', '--inline-query', code]))
}
function appendFixture(
	production: boolean,
	directory: string,
	table: string,
	rows: unknown[],
) {
	const file = resolve(
		directory,
		`${table}-${randomBytes(3).toString('hex')}.json`,
	)
	writeFileSync(file, JSON.stringify(rows), { mode: 0o600 })
	// Append only. Never replace a production table or import an old snapshot.
	convexCLI(production, ['import', '--append', '--table', table, file])
}
function pack(moduleType: 'data' | 'resources', name: string) {
	return zipSync({
		'manifest.json': strToU8(
			JSON.stringify({
				format_version: 2,
				header: {
					name,
					description:
						'Temporary automated publishing acceptance fixture',
					uuid: randomUUID(),
					version: [1, 0, 0],
					min_engine_version: [1, 21, 0],
				},
				modules: [
					{
						type: moduleType,
						uuid: randomUUID(),
						version: [1, 0, 0],
					},
				],
			}),
		),
		'README.txt': strToU8(
			'E2E acceptance fixture. No gameplay compatibility claim.',
		),
	})
}
/** Seconds Better Auth asks a rate-limited client to wait (`X-Retry-After`). */
export function retryAfterSeconds(headers: Record<string, string>) {
	const seconds = Number(headers['x-retry-after'])
	return Number.isFinite(seconds) && seconds > 0 ? seconds : 60
}

/**
 * Sign-in is limited to 5 attempts a minute per client address, and one run
 * signs in more often than that. Wait out a 429 instead of failing; the limit
 * resets once a full window passes without an allowed sign-in.
 */
export async function signInRespectingRateLimit<
	T extends { status: () => number; headers: () => Record<string, string> },
>(attempt: () => Promise<T>): Promise<T> {
	for (let tries = 0; ; tries++) {
		const response = await attempt()
		if (response.status() !== 429 || tries >= 3) {
			return response
		}
		const wait = retryAfterSeconds(response.headers()) + 1
		console.info(`Sign-in rate limited; waiting ${wait}s`)
		await new Promise((done) => setTimeout(done, wait * 1000))
	}
}

async function makeAccount(
	production: boolean,
	baseURL: string,
	runId: string,
	directory: string,
	role: Role,
) {
	const username = `${runId}_${role}`
	const email = `${username}@example.invalid`
	const password = `${randomBytes(24).toString('base64url')}!7a`
	const now = Date.now()
	const user = operatorRun(
		production,
		'adapter:create',
		{
			input: {
				model: 'user',
				data: {
					name: `E2E ${role} ${runId}`,
					username,
					displayUsername: username,
					email,
					emailVerified: true,
					role: role === 'creator' ? 'user' : role,
					createdAt: now,
					updatedAt: now,
				},
			},
		},
		'betterAuth',
	)
	try {
		operatorRun(
			production,
			'adapter:create',
			{
				input: {
					model: 'account',
					data: {
						accountId: user._id,
						providerId: 'credential',
						userId: user._id,
						password: await hashPassword(password),
						createdAt: now,
						updatedAt: now,
					},
				},
			},
			'betterAuth',
		)
		const http = await request.newContext({
			baseURL,
			extraHTTPHeaders: { origin: baseURL },
		})
		const login = await signInRespectingRateLimit(() =>
			http.post('/api/auth/sign-in/email', { data: { email, password } }),
		)
		expect(login.status(), `Sign in as fixture ${role}`).toBe(200)
		const tokenResponse = await http.get('/api/auth/convex/token')
		expect(tokenResponse.ok()).toBe(true)
		const { token } = await tokenResponse.json()
		const convexURL = production
			? 'https://veracious-albatross-36.convex.cloud'
			: (process.env.E2E_CONVEX_URL ??
				'https://original-crocodile-504.convex.cloud')
		const client = new ConvexHttpClient(convexURL, { logger: false })
		client.setAuth(token)
		const storage = resolve(directory, `${role}.json`)
		await http.storageState({ path: storage })
		return {
			id: String(user._id),
			username,
			email,
			password,
			storage,
			client,
			request: http,
		}
	} catch (error) {
		const existing = operatorRun(
			production,
			'adapter:findOne',
			{
				model: 'user',
				where: [{ field: '_id', value: String(user._id) }],
			},
			'betterAuth',
		)
		if (existing?.email === email && existing.username === username) {
			for (const model of ['session', 'account']) {
				let done = false
				while (!done) {
					const deleted = operatorRun(
						production,
						'adapter:deleteMany',
						{
							input: {
								model,
								where: [
									{
										field: 'userId',
										value: String(user._id),
									},
								],
							},
							paginationOpts: { numItems: 50, cursor: null },
						},
						'betterAuth',
					)
					done = deleted.isDone
				}
			}
			operatorRun(
				production,
				'adapter:deleteOne',
				{
					input: {
						model: 'user',
						where: [{ field: '_id', value: String(user._id) }],
					},
				},
				'betterAuth',
			)
		}
		throw error
	}
}
async function uploadArtifact(
	account: TestAccount,
	projectId: Id<'projects'>,
	kind: 'addon' | 'resource_pack',
	name: string,
) {
	const resources = pack('resources', name)
	const bytes =
		kind === 'addon'
			? zipSync({
					'behavior.mcpack': pack('data', name),
					'resources.mcpack': resources,
				})
			: resources
	const fileName =
		kind === 'addon' ? 'acceptance.mcaddon' : 'acceptance.mcpack'
	const fileHash = createHash('sha256').update(bytes).digest('hex')
	const upload = await account.client.mutation(
		api.functions.projects.versions.generateVersionUploadUrl,
		{
			projectId,
			version: '1.0.0',
			fileName,
			fileSize: bytes.byteLength,
		},
	)
	try {
		const put = await account.request.put(upload.url, {
			data: Buffer.from(bytes),
			headers: { 'Content-Type': 'application/octet-stream' },
		})
		if (!put.ok()) {
			throw new Error(`Artifact upload failed: ${put.status()}`)
		}
		await account.client.mutation(api.lib.r2.syncUploadMetadata, {
			key: upload.key,
		})
		// syncUploadMetadata schedules a storage read; wait for that operation,
		// rather than treating its scheduling acknowledgement as completion.
		await expect
			.poll(
				async () => {
					try {
						const result = await account.client.mutation(
							api.functions.projects.versions.create,
							{
								projectId,
								version: '1.0.0',
								uploadId: upload.uploadId,
								changelog:
									'Initial automated acceptance fixture.',
								gameVersions: ['1.21.0'],
							},
						)
						if (!result.ok) {
							throw new Error(result.error)
						}
						return true
					} catch (error) {
						if (METADATA_PENDING.test(String(error))) {
							return false
						}
						throw error
					}
				},
				{ timeout: 30_000, intervals: [500, 1000, 2000] },
			)
			.toBe(true)
	} catch (error) {
		await account.client.mutation(
			api.functions.projects.versions.discardUpload,
			{ uploadId: upload.uploadId },
		)
		throw error
	}
	await expect
		.poll(
			async () => {
				const versions = await account.client.query(
					api.functions.projects.versions.list,
					{ projectId },
				)
				const version = versions[0]
				if (version?.validationStatus === 'invalid') {
					throw new Error(version.validationError)
				}
				return version?.validationStatus
			},
			{ timeout: 120_000, intervals: [1000, 2000, 4000] },
		)
		.toBe('valid')
	return fileHash
}
async function cleanupListing(
	creator: TestAccount,
	listing: TestListing,
	runId: string,
) {
	if (!listing.name.includes(runId)) {
		throw new Error('Fixture identity mismatch')
	}
	const owner =
		listing.kind === 'server'
			? await creator.client.query(
					api.functions.servers.servers.getForEdit,
					{ id: listing.id },
				)
			: await creator.client.query(
					api.functions.projects.projects.getForEdit,
					{ id: listing.id as Id<'projects'> },
				)
	if (!owner) {
		return
	}
	if (owner.ownerId !== creator.id || owner.name !== listing.name) {
		throw new Error('Fixture owner mismatch')
	}
	if (listing.kind === 'server') {
		await creator.client.mutation(api.functions.servers.servers.remove, {
			id: listing.id as Id<'servers'>,
		})
	} else {
		await creator.client.mutation(api.functions.projects.projects.remove, {
			id: listing.id as Id<'projects'>,
		})
	}
}

async function cleanupAccount(account: TestAccount, production: boolean) {
	const response = await account.request.post('/api/auth/delete-user', {
		data: { password: account.password },
	})
	if (!response.ok()) {
		throw new Error(`Account deletion returned ${response.status()}`)
	}
	const remainingUser = operatorRun(
		production,
		'adapter:findOne',
		{
			model: 'user',
			where: [{ field: '_id', value: account.id }],
		},
		'betterAuth',
	)
	if (remainingUser) {
		throw new Error('Temporary account still exists after deletion')
	}
	await account.request.dispose()
}

async function cleanupAccounts(
	accounts: Record<Role, TestAccount>,
	production: boolean,
) {
	const failures: string[] = []
	for (const [role, account] of Object.entries(accounts)) {
		try {
			await cleanupAccount(account, production)
		} catch (error) {
			failures.push(`${role}: ${String(error)}`)
		}
	}
	return failures
}

export async function provisionPublishingFixture(
	baseURL: string,
	projectName: string,
): Promise<PublishingFixture> {
	const origin = new URL(baseURL).origin
	const production = origin === 'https://bedrocknexus.com'
	if (
		!(
			production ||
			['localhost', '127.0.0.1'].includes(new URL(origin).hostname)
		)
	) {
		throw new Error(
			'Publishing fixtures support localhost or the explicit production origin only',
		)
	}
	if (production && process.env.E2E_ALLOW_PRODUCTION !== '1') {
		throw new Error(
			'Set E2E_ALLOW_PRODUCTION=1 to authorize isolated production fixture writes',
		)
	}
	const runId = `e2e${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
	const directory = resolve('.e2e/publishing', `${projectName}-${runId}`)
	mkdirSync(directory, { recursive: true })
	const accounts = {} as Record<Role, TestAccount>
	const listings: TestListing[] = []
	const persist = () =>
		writeFileSync(
			resolve(directory, 'manifest.json'),
			JSON.stringify(
				{
					runId,
					baseURL: origin,
					production,
					listings,
					accounts: Object.fromEntries(
						Object.entries(accounts).map(([role, account]) => [
							role,
							{
								id: account.id,
								username: account.username,
								email: account.email,
								password: account.password,
								storage: account.storage,
							},
						]),
					),
				},
				null,
				2,
			),
			{ mode: 0o600 },
		)
	const cleanup = async () => {
		const failures: string[] = []
		for (const listing of listings) {
			try {
				await cleanupListing(accounts.creator, listing, runId)
			} catch (error) {
				failures.push(`${listing.kind}: ${String(error)}`)
			}
		}
		const remaining = inspect(
			production,
			`return (await Promise.all(${JSON.stringify(listings.map((listing) => listing.id))}.map(id=>ctx.db.get(id)))).filter(Boolean).map(item=>item._id);`,
		) as string[]
		if (remaining.length) {
			failures.push(
				`Fixture listings still exist: ${remaining.join(', ')}`,
			)
		}
		if (!failures.length) {
			failures.push(...(await cleanupAccounts(accounts, production)))
		}
		if (!failures.length) {
			for (const account of Object.values(accounts)) {
				unlinkSync(account.storage)
			}
			writeFileSync(
				resolve(directory, 'manifest.json'),
				JSON.stringify(
					{
						runId,
						baseURL: origin,
						production,
						listings,
						credentialsRemoved: true,
						accounts: Object.fromEntries(
							Object.entries(accounts).map(([role, account]) => [
								role,
								{
									id: account.id,
									username: account.username,
									email: account.email,
								},
							]),
						),
					},
					null,
					2,
				),
			)
		}

		writeFileSync(
			resolve(directory, 'cleanup.json'),
			JSON.stringify(
				{
					runId,
					completedAt: new Date().toISOString(),
					failures,
					retained:
						'Append-only moderation audit and fixture announcement suppression records',
				},
				null,
				2,
			),
		)
		if (failures.length) {
			throw new Error(
				`Fixture cleanup incomplete; see ${directory}/cleanup.json`,
			)
		}
	}
	try {
		for (const role of ['creator', 'moderator', 'admin'] as const) {
			accounts[role] = await makeAccount(
				production,
				origin,
				runId,
				directory,
				role,
			)
			persist()
		}
		const categories = inspect(
			production,
			'return (await ctx.db.query("projectCategories").take(100)).map(c=>({id:c._id,type:c.projectType,active:c.isActive}));',
		) as { id: Id<'projectCategories'>; type: string; active: boolean }[]
		for (const kind of ['addon', 'resource_pack'] as const) {
			const category = categories.find((c) => c.type === kind && c.active)
			if (!category) {
				throw new Error(`No active category for ${kind}`)
			}
			const name = `E2E ${kind === 'addon' ? 'Addon' : 'Resource Pack'} ${runId}`
			const created = await accounts.creator.client.mutation(
				api.functions.projects.projects.create,
				{
					type: kind,
					name,
					summary:
						'Temporary publishing acceptance fixture with installation instructions.',
					description:
						'## Automated publishing acceptance\n\nTemporary fixture. Import the included pack into a test world. This exercises publication and download delivery, not Minecraft gameplay compatibility.',
					categoryIds: [category.id],
					ownerType: 'user',
					ownerId: accounts.creator.id,
				},
			)
			const listing: TestListing = {
				id: created.id,
				slug: created.slug,
				name,
				kind,
				edit: `/dashboard/${kind === 'addon' ? 'addons' : 'resource-packs'}/${created.id}`,
				review: `/moderation/${kind === 'addon' ? 'addons' : 'resource-packs'}/${created.id}`,
				public: contentHref(kind, created.slug, created.id),
			}
			listings.push(listing)
			persist()
			appendFixture(production, directory, 'discordAnnouncements', [
				{
					key: `project:${created.id}`,
					kind: 'project',
					targetId: created.id,
					status: 'skipped',
					attempts: 0,
					lastError:
						'Automated E2E fixture: announcement intentionally suppressed',
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
			])
			listing.fileHash = await uploadArtifact(
				accounts.creator,
				created.id,
				kind,
				name,
			)
			persist()
		}
		const serverCategories = inspect(
			production,
			'return (await ctx.db.query("serverCategories").take(30)).map(c=>({id:c._id,active:c.isActive}));',
		) as { id: Id<'serverCategories'>; active: boolean }[]
		const serverCategory = serverCategories.find((c) => c.active)
		if (!serverCategory) {
			throw new Error('No active server category')
		}
		const host = `${runId}.example.invalid`
		appendFixture(production, directory, 'serverVerificationProofs', [
			{
				userId: accounts.creator.id,
				ipAddress: host,
				port: 19_132,
				method: 'manual',
				verifiedAt: Date.now(),
				expiresAt: Date.now() + 300_000,
			},
		])
		const name = `E2E Server ${runId}`
		const serverId = await accounts.creator.client.mutation(
			api.functions.servers.servers.create,
			{
				name,
				smallDescription:
					'Temporary automated publishing acceptance server.',
				description:
					'Temporary fixture for submission, correction and moderator approval testing.',
				ipAddress: host,
				port: 19_132,
				categoryIds: [serverCategory.id],
			},
		)
		const server = await accounts.creator.client.query(
			api.functions.servers.servers.getForEdit,
			{ id: serverId },
		)
		if (!server) {
			throw new Error('Created server could not be read by its owner')
		}
		listings.push({
			id: serverId,
			slug: server.slug,
			name,
			kind: 'server',
			edit: `/dashboard/servers/${serverId}`,
			review: `/moderation/servers/${serverId}`,
			public: `/servers/${server.slug}`,
		})
		persist()
		appendFixture(production, directory, 'discordAnnouncements', [
			{
				key: `server:${serverId}`,
				kind: 'server',
				targetId: serverId,
				status: 'skipped',
				attempts: 0,
				lastError:
					'Automated E2E fixture: announcement intentionally suppressed',
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
		])
		return {
			runId,
			baseURL: origin,
			directory,
			production,
			accounts,
			listings,
			cleanup,
		}
	} catch (error) {
		await cleanup().catch((cleanupError) =>
			console.error(String(cleanupError)),
		)
		throw error
	}
}
